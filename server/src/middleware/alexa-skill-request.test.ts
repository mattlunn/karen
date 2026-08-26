import { Request, Response, NextFunction } from 'express';

const SKILL_ID = 'amzn1.ask.skill.00000000-0000-4000-8000-000000000000';

jest.mock('../config/app', () => ({ alexa: { id: SKILL_ID } }));
jest.mock('../logger', () => ({ warn: jest.fn() }));

import alexaSkillRequest from './alexa-skill-request';

function run(body: unknown) {
  const status = jest.fn().mockReturnThis();
  const res = { status, end: jest.fn() } as unknown as Response;
  const next = jest.fn() as NextFunction;

  alexaSkillRequest({ body } as Request, res, next);

  return { status, next };
}

describe('alexaSkillRequest', () => {
  function bodyForSkill(applicationId: unknown) {
    return { context: { System: { application: { applicationId } } } };
  }

  it('passes a request sent for our own skill through', () => {
    const { status, next } = run(bodyForSkill(SKILL_ID));

    expect(next).toHaveBeenCalled();
    expect(status).not.toHaveBeenCalled();
  });

  it('rejects a request sent for another skill', () => {
    const { status, next } = run(bodyForSkill('amzn1.ask.skill.11111111-1111-4111-8111-111111111111'));

    expect(next).not.toHaveBeenCalled();
    expect(status).toHaveBeenCalledWith(401);
  });

  it('rejects a request with no applicationId', () => {
    const { status, next } = run(bodyForSkill(undefined));

    expect(next).not.toHaveBeenCalled();
    expect(status).toHaveBeenCalledWith(401);
  });

  it('rejects a body with no context at all', () => {
    const { status, next } = run({});

    expect(next).not.toHaveBeenCalled();
    expect(status).toHaveBeenCalledWith(401);
  });

  it('rejects a body that is not an object', () => {
    const { status, next } = run(undefined);

    expect(next).not.toHaveBeenCalled();
    expect(status).toHaveBeenCalledWith(401);
  });
});
