import { User, Stay } from '../../models';
import { UserResponse } from '../../api/types';

export function mapUserToResponse(
  user: User,
  currentStay: Stay | null,
  upcomingStay: Stay | null
): UserResponse {
  const isAway = !currentStay || currentStay.departure !== null;

  if (isAway) {
    return {
      id: user.handle,
      avatar: user.avatar,
      status: 'AWAY',
      since: null,
      until: upcomingStay?.eta ? +upcomingStay.eta : null,
    };
  }

  return {
    id: user.handle,
    avatar: user.avatar,
    status: 'HOME',
    since: +currentStay.arrival!,
    until: null,
  };
}
