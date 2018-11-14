import Sequelize, { Op } from 'sequelize';
import { randomBytes } from 'crypto';
import { promisify } from 'util';

export default function (sequelize) {
  const token = sequelize.define('token', {
    expiresAt: {
      type: Sequelize.DATE
    },
    token: {
      type: Sequelize.STRING,
      unique: true,
      allowNull: false
    },
    userId: {
      type: Sequelize.INTEGER,
      references: {
        model: 'user',
        key: 'id'
      },
      allowNull: false
    }
  });

  token.createForUser = async function (user, expiresAt = null) {
    // https://stackoverflow.com/a/13378842/444991
    const value = (await (promisify(randomBytes)(188))).toString('base64');

    await this.create({
      token: value,
      userId: user.id,
      expiresAt
    });

    return value;
  };

  token.isValid = async function (token) {
    return !!await this.findOne({
      where: {
        expiresAt: {
          [Op.or]: {
            [Op.eq]: null,
            [Op.gt]: new Date()
          }
        },

        token
      }
    });
  };

  token.expire = async function (token) {
    try {
      const [affected] = await this.update({
        expiresAt: new Date(),
      }, {
        where: {
          token: {
            [Op.eq]: token
          }
        }
      });

      return affected === 1;
    } catch (e) {
      console.error(e);
    }

    return false;
  };

  return token;
};