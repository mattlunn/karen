import { Sequelize, DataTypes, Model, InferAttributes, InferCreationAttributes, CreationOptional, NonAttribute, BelongsToManySetAssociationsMixin, Op } from 'sequelize';
import bus, { LOG_CREATED } from '../bus';
import { Device } from './device';
import { User } from './user';
import { TimeRangeSelector } from './capabilities/helpers';
import { LogAudience, LogSeverity } from '../api/types';

type NotifyOptions = {
  severity: LogSeverity;
  message: string;
  devices?: Device[];
  audience?: Exclude<LogAudience, 'user'> | { user: string };
  image?: Buffer;
  sound?: string;
};

export class Log extends Model<InferAttributes<Log>, InferCreationAttributes<Log>> {
  declare id: CreationOptional<number>;
  declare severity: LogSeverity;
  declare message: string;
  declare audience: LogAudience;
  declare userId: number | null;
  declare createdAt: CreationOptional<Date>;
  declare updatedAt: CreationOptional<Date>;

  declare user?: NonAttribute<User | null>;
  declare setDevices: BelongsToManySetAssociationsMixin<Device, number>;

  static async notify({ severity, message, devices = [], audience = 'admins', image, sound }: NotifyOptions): Promise<Log> {
    let user: User | null = null;

    if (typeof audience === 'object') {
      [user] = await User.findByHandles([audience.user]);

      if (!user) {
        throw new Error(`Cannot notify unknown user "${audience.user}"`);
      }
    }

    const log = Log.build({
      severity,
      message,
      audience: typeof audience === 'object' ? 'user' : audience,
      userId: user?.id ?? null
    });

    // Delivered before saving, so a database problem can't stop an alert going out.
    bus.emit(LOG_CREATED, { log, image, sound });

    await log.save();
    await log.setDevices(devices);

    return log;
  }

  static findForDevice(device: Device, { since, until }: TimeRangeSelector): Promise<Log[]> {
    return Log.findAll({
      where: {
        createdAt: {
          [Op.gte]: since,
          [Op.lt]: until
        }
      },
      include: [
        { model: Device, where: { id: device.id }, attributes: [] },
        { model: User, attributes: ['handle'] }
      ],
      order: [['createdAt', 'ASC']]
    });
  }

  async getAudienceUsers(): Promise<User[]> {
    switch (this.audience) {
      // Admins are a Pushover group, not a set of users.
      case 'admins':
        return [];
      case 'all':
        return User.findAll();
      case 'absent':
        return User.getAbsentUsers();
      case 'user':
        return User.findAllById([this.userId!]);
    }
  }
}

export default function (sequelize: Sequelize) {
  Log.init({
    id: {
      type: DataTypes.INTEGER,
      allowNull: false,
      primaryKey: true,
      autoIncrement: true
    },

    severity: {
      type: DataTypes.ENUM('info', 'notice', 'warning', 'critical'),
      allowNull: false
    },

    message: {
      type: DataTypes.TEXT,
      allowNull: false
    },

    audience: {
      type: DataTypes.ENUM('admins', 'all', 'absent', 'user'),
      allowNull: false
    },

    userId: {
      type: DataTypes.INTEGER,
      allowNull: true,
      defaultValue: null
    },

    createdAt: {
      type: DataTypes.DATE(3),
      allowNull: false
    },

    updatedAt: {
      type: DataTypes.DATE(3),
      allowNull: false
    }
  }, {
    sequelize,
    modelName: 'log'
  });
}
