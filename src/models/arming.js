import Sequelize, { Op } from 'sequelize';

export default function (sequelize) {
  const arming = sequelize.define('arming', {
    start: {
      type: Sequelize.DATE,
      allowNull: false
    },

    end: {
      type: Sequelize.DATE,
      allowNull: true
    },

    mode: {
      type: Sequelize.ENUM(['NIGHT', 'AWAY']),
      allowNull: false
    }
  });

  arming.getActiveArming = function (when = Date.now()) {
    return this.findOne({
      where: {
        start: {
          [Op.lt]: when
        },
        end: {
          [Op.or]: [{
            [Op.gte]: when,
          }, {
            [Op.eq]: null
          }]
        }
      }
    });
  };

  arming.prototype.getMostRecentActivation = async function() {
    const activations = await this.getAlarmActivations();

    return activations.reduce((mostRecent, curr) => {
      return mostRecent.startedAt > curr.startedAt ? mostRecent : curr;
    });
  };

  arming.MODE_AWAY = 'AWAY';
  arming.MODE_NIGHT = 'NIGHT';

  return arming;
}