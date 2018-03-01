import Sequelize from 'sequelize';
import bcrypt from 'bcrypt';
import { createHash } from 'crypto';

export default function (sequelize) {
  const user = sequelize.define('user', {
    handle: {
      type: Sequelize.STRING,
      allowNull: false,
      unique: true
    },
    password: {
      type: Sequelize.STRING,
      allowNull: false
    },
    email: {
      type: Sequelize.STRING,
      allowNull: false,
      defaultValue: ''
    },
    avatar: {
      type: Sequelize.VIRTUAL,
      get: function () {
        const md5Hash = createHash('md5').update(this.get('email')).digest('hex');

        return `https://www.gravatar.com/avatar/${md5Hash}?s=32&d=identicon`;
      }
    }
  });

  user.findByCredentials = function (handle, password) {
    return this.findOne({
      where: {
        handle: handle
      }
    }).then(user => {
      if (user && bcrypt.compareSync(password, user.password)) {
        return user;
      }

      return Promise.reject();
    });
  };

  user.findByHandle = function (handle) {
    return this.findOne({
      where: {
        handle: handle
      }
    });
  };

  return user;
};