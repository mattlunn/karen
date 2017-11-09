export const LOADING_RESOURCE = 'LOADING_RESOURCE';
export const LOADED_RESOURCE = 'LOADED_RESOURCE';
export const ERROR_LOADING_RESOURCE = 'ERROR_LOADING_RESOURCE';

export default function (state = { loaded: [], loading: [] }, action) {
  switch (action.type) {
    case LOADING_RESOURCE:
      return {
        ...state,
        loading: [...state.loading, action.name]
      };
    case LOADED_RESOURCE:
      return {
        ...state,
        loaded: [...state.loaded, action.name],
        loading: [...state.loading.filter(x => x !== action.name)]
      };
    case ERROR_LOADING_RESOURCE:
      return {
        ...state,
        loading: [...state.loading.filter(x => x !== action.name)]
      };
    default:
      return state;
  }
}

export function getLoadedResources(resources, filter) {
  if (Array.isArray(filter)) {
    return resources.loaded.filter(x => filter.includes(x));
  } else {
    return resources.loaded;
  }
}

export function getIsResourceLoading(resources, resource) {
  return resources.loading.includes(resource);
}