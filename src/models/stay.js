import Sequelize from 'sequelize';

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

  stay.findUpcomingStay = function (userId) {
    return this.findOne({
      where: {
        arrival: null,
        userId
      }
    });
  };

  stay.findCurrentOrLastStay = function (userId) {
    return this.findOne({
      where: {
        arrival: {
          $not: null
        },
        userId
      },

      order: [
        ['arrival', 'DESC']
      ]
    });
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

  return stay;
};