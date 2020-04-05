export async function changeLightsToDesiredState(lights, desiredState) {
  const actions = await Promise.all(lights.map(async (device) => {
    const state = await device.getProperty('on');
    const name = device.name;

    try {
      if (state !== desiredState) {
        await device.setProperty('on', desiredState);
      }
    } catch (e) {
      return {
        name,
        currentState: state
      };
    }

    return {
      name,
      currentState: desiredState
    };
  }));

  return {
    failedUpdates: actions.filter(({ currentState }) => currentState !== desiredState),
    successfulUpdates: actions.filter(({ currentState }) => currentState === desiredState)
  };
}