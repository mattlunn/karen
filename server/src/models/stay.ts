import bus, { FIRST_USER_HOME, LAST_USER_LEAVES, STAY_START, STAY_END } from '../bus';
import { Sequelize, DataTypes, Model, InferAttributes, InferCreationAttributes, Op, CreationOptional, HasOneGetAssociationMixin } from 'sequelize';
import { User } from './user';

export class Stay extends Model<InferAttributes<Stay>, InferCreationAttributes<Stay>> {
  declare public id: CreationOptional<Number>;
  declare public eta: CreationOptional<Date | null>;
  declare public arrival: CreationOptional<Date | null>;
  declare public arrivalTrigger: CreationOptional<string | null>;
  declare public departure: CreationOptional<Date | null>;
  declare public userId: CreationOptional<Number | null>;
  declare public createdAt: CreationOptional<Date>;
  declare public updatedAt: CreationOptional<Date>;

  declare getUser: HasOneGetAssociationMixin<User>;

  static async findUpcomingStays(userIds: Number[]) {
    const stays = await Promise.all(userIds.map(userId => this.findOne({
      where: {
        arrival: null,
        userId
      }
    })));

    return stays.filter(stay => stay);
  };

  static findNextUpcomingEta() {
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

  static async findCurrentOrLastStays(userIds: Number[]) {
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

  static findCurrentStay(userId: Number) {
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

  static findCurrentStays() {
    return this.findAll({
      where: {
        departure: null,
        arrival: {
          [Op.not]: null
        }
      }
    });
  };

  static findUnclaimedEta(since: Date) {
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

  static async checkIfSomeoneHomeAt(date: Date) {
    return await this.findOne({
      where: {
        arrival: {
          [Op.lt]: date
        },

        [Op.or]: [{
          departure: {
            [Op.gt]: date
          }
        }, {
          departure: null
        }]
      }
    }) !== null;
  };
}

export default function (sequelize: Sequelize) {
  Stay.init({
    id: {
      type: DataTypes.NUMBER,
      allowNull: false,
      primaryKey: true,
      autoIncrement: true,
      unique: true
    },
    eta: {
      type: DataTypes.DATE,
      allowNull: true
    },
    arrival: {
      type: DataTypes.DATE,
      allowNull: true
    },
    arrivalTrigger: {
      type: DataTypes.STRING,
      allowNull: true
    },
    departure: {
      type: DataTypes.DATE,
      allowNull: true
    },
    createdAt: {
      type: DataTypes.DATE
    },
    updatedAt: {
      type: DataTypes.DATE
    },
    userId: {
      type: DataTypes.INTEGER,
      references: {
        model: 'user',
        key: 'id'
      },
      allowNull: true
    }
  }, {
    modelName: 'stay',
    sequelize
  });

  Stay.addHook('afterSave', async function (stay: Stay) {
    bus.emit(stay.departure ? STAY_END : STAY_START, stay);

    if (stay.changed('departure')) {
      const currentlyAtHome = await Stay.findCurrentStays();

      if (!currentlyAtHome.length) {
        bus.emit(LAST_USER_LEAVES, stay);
      }
    } else if (stay.changed('arrival')) {
      const currentlyAtHome = await Stay.findCurrentStays();

      if (currentlyAtHome.length === 1) {
        bus.emit(FIRST_USER_HOME, stay);
      }
    }
  });
}