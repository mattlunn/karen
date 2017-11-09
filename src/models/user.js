import Sequelize from 'sequelize';
import bcrypt from 'bcrypt';

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

  return user;
};