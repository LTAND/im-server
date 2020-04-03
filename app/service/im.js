'use strict';
// const urls = require('../libs/urls');

/**
 * 状态管理
 */

/**
 * 在线用户map
 * id: user.id,
 * sockets: ['ssd1asdsd','323sdwerfw22']
 * messages: []
 */
const userMap = new Map();

module.exports = app => {
  class Io extends app.Service {
    // 链接用户
    async connect(socket) {
      const { userId } = socket.handshake.query;
      this.addUser({ socketId: socket.id, userId });

      // 获取在线的cs和client集合
      const userList = await this.getOnlineUserList();
      // 向本socket发送
      // await this.ctx.socket.emit('/v1/user-list-change', {
      //   userList
      // });
      // 广播
      this.ctx.socket.broadcast.emit('/v1/user-list-change', {
        userList
      });
    }

    // 断开客服or客户
    async disconnect(socket) {
      const { userId } = socket.handshake.query;
      this.removeUser({ socketId: socket.id, userId });
      const userList = this.getOnlineUserList();
      // 广播
      this.ctx.socket.broadcast.emit('/v1/cs/user-list-change', {
        userList
      });
    }

    // 添加新User
    addUser({ socketId, userId }) {
      if (userMap.has(userId)) {
        userMap.get(userId).sockets.push(socketId);
      } else {
        userMap.set(userId, {
          sockets: [socketId],
          messages: []
        });
      }
    }

    removeUser({ socketId, userId }) {
      if (!userMap.has(userId)) {
        return;
      }
      let sockets = userMap.get(userId).sockets;
      let socketIndex = userMap.get(userId).sockets.indexOf(socketId);
      if (socketIndex !== -1) {
        sockets.splice(socketIndex, 1);
        if (sockets.length === 0) {
          userMap.delete(userId);
        }
      }
    }

    // 获取当前在线userList
    getOnlineUserList() {
      const userList = [];
      for (const id of userMap.keys()) {
        userList.push(id);
      }
      return userList;
    }

    // 单人发消息
    async sendUserMessage({ userId, message }) {
      if (userMap.has(userId)) {
        const sockets = clientMap.get(id).sockets;
        for (const socketId of sockets) {
          await this.sendMessage(socketId, message);
        }
      }
    }

    // 发送消息
    async sendMessage(message) {
      const newMessage = await this.saveMessage(message);
      app.io.to(message.sessionId).emit('/v1/im/new-message', newMessage);
    }

    // 存储消息
    async saveMessage(message) {
      const { ctx } = this;
      const session = await ctx.model.Session.findByPk(message.sessionId);
      const newMession = await ctx.model.Message.create({
        hasRead: false,
        body: message.body,
        fromId: message.fromId,
        toId: message.toId
      });
      await session.addMessage(newMession);
      // 注意这里重新查询是为了和已经持久化的model格式统一
      return await ctx.model.Message.findByPk(newMession.id);
    }

    async getMessages({ sessionId, pageSize = 10, pageNumber = 1 }) {
      const { ctx } = this;
      // 计数查询
      let result = await ctx.model.Message.findAndCountAll({
        where: {
          sessionId: sessionId
        },
        offset: pageSize * (pageNumber - 1),
        limit: pageSize,
        order: [['created_at', 'DESC']]
      });
      ctx.socket.emit('/v1/im/get-messages', {
        sessionId,
        pageSize,
        pageNumber,
        count: result.count,
        messages: result.rows
      });
    }
  }
  return Io;
};