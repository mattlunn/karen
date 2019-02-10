import Sequelize from 'sequelize';
import bus, { FIRST_USER_HOME, LAST_USER_LEAVES } from '../bus';

export default function (sequelize) {
  const stay = sequelize.define('stay', {
    eta: {
      type: Sequelize.DATE
    },
    etaSentToNestAt: {
      type: Sequelize.DATE
    },
    arrival: {
      type: Sequelize.DATE
    },
    arrivalSentToNestAt: {
      type: Sequelize.DATE
    },
    departure: {
      type: Sequelize.DATE
    },
    departureSentToNestAt: {
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

  stay.findUpcomingStays = function (userIds) {
    return Promise.all(userIds.map(userId => this.findOne({
      where: {
        arrival: null,
        userId
      }
    })));
  };

  stay.findCurrentOrLastStays = function (userIds) {
    return Promise.all(userIds.map((userId) => this.findOne({
      where: {
        arrival: {
          $not: null
        },
        userId
      },

      order: [
        ['arrival', 'DESC']
      ]
    })));
  };

  stay.findCurrentStay = function (userId) {
    return this.findOne({
      where: {
        departure: null,
        arrival: {
          $not: null
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
          $not: null
        }
      }
    });
  };

  stay.findNextEta = function (date) {
    return this.findOne({
      where: {
        etaSentToNestAt: null,
        eta: {
          lt: date,
          gt: new Date()
        },
        userId: {
          $not: null
        },
        arrival: null
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
          $lt: timestamp
        },

        $or: [{
          departure: {
            $gt: timestamp
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
};