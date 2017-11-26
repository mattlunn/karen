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
    }
  });

  stay.findUpcomingStay = function () {
    return this.findOne({
      where: {
        arrival: null
      }
    });
  };

  stay.findCurrentOrLastStay = function () {
    return this.findOne({
      where: {
        arrival: {
          $not: null
        }
      },

      order: [
        ['arrival', 'DESC']
      ]
    });
  };

  stay.findCurrentStay = function () {
    return this.findOne({
      where: {
        departure: null,
        arrival: {
          $not: null
        }
      }
    });
  };

  stay.getUnsentEtasBefore = function (date) {
    return this.findAll({
      where: {
        etaSentToNestAt: null,
        eta: {
          lt: date
        },
        arrival: null
      }
    });
  };

  return stay;
};