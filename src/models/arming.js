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
    }
  });

  arming.getActiveArming = function (when = new Date()) {
    return this.findOne({
      where: {
        start: {
          [Op.lte]: when
        },

        end: {
          [Op.or]: [{
            [Op.lt]: when
          }, {
            [Op.eq]: null
          }]
        },
      }
    });
  };

  return arming;
}