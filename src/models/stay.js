import Sequelize, { Op } from 'sequelize';
import bus, { FIRST_USER_HOME, LAST_USER_LEAVES } from '../bus';

export default function (sequelize) {
  const stay = sequelize.define('stay', {
    eta: {
      type: Sequelize.DATE
    },
    arrival: {
      type: Sequelize.DATE
    },
    departure: {
      type: Sequelize.DATE
    },
    userId: {
      type: Sequelize.INTEGER,
      references: {
        model: 'user',
        key: 'id'
      },
      allowNull: true
    }
  });

  stay.findUpcomingStays = async function (userIds) {
    const stays = await Promise.all(userIds.map(userId => this.findOne({
      where: {
        arrival: null,
        userId
      }
    })));

    return stays.filter(stay => stay);
  };

  stay.findNextUpcomingEta = function () {
    return this.findOne({
      where: {
        eta: {
          [Op.gt]: Date.now()
        },

        arrival: null
      },

      order: [
        'eta'
      ]
    });
  };

  stay.findCurrentOrLastStays = async function (userIds) {
    const stays = await Promise.all(userIds.map((userId) => this.findOne({
      where: {
        arrival: {
          [Op.not]: null
        },
        userId
      },

      order: [
        ['arrival', 'DESC']
      ]
    })));

    return stays.filter(stay => stay);
  };

  stay.findCurrentStay = function (userId) {
    return this.findOne({
      where: {
        departure: null,
        arrival: {
          [Op.not]: null
        },
        userId
      }
    });
  };

  stay.findCurrentStays = function () {
    return this.findAll({
      where: {
        departure: null,
        arrival: {
          [Op.not]: null
        }
      }
    });
  };

  stay.findUnclaimedEta = function (since) {
    return this.findOne({
      where: {
        createdAt: {
          gt: since
        },
        eta: {
          gt: new Date()
        },
        userId: null
      },

      order: [
        ['createdAt', 'ASC']
      ]
    });
  };

  stay.checkIfSomeoneHomeAt = async function (timestamp) {
    return await this.findOne({
      where: {
        arrival: {
          [Op.lt]: timestamp
        },

        [Op.or]: [{
          departure: {
            [Op.gt]: timestamp
          }
        }, {
          departure: null
        }]
      }
    }) !== null;
  };

  stay.addHook('afterSave', async function (stay) {
    if (stay.changed('departure')) {
      const currentlyAtHome = await this.findCurrentStays();

      if (!currentlyAtHome.length) {
        bus.emit(LAST_USER_LEAVES, stay);
      }
    } else if (stay.changed('arrival')) {
      const currentlyAtHome = await this.findCurrentStays();

      if (currentlyAtHome.length === 1) {
        bus.emit(FIRST_USER_HOME, stay);
      }
    }
  });

  return stay;
}