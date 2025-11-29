import { userError, users } from '$lib/store';
import type { User } from '$lib/types';
import { createSyncFunction } from './createSyncFactory';

export const usersSync = createSyncFunction<User>({
	name: 'users',
	storageKey: 'users_v5',
	apiEndpoint: 'users',
	limit: 7500,
	store: users,
	errorStore: userError,
	filterDeleted: (user) => !user.deleted_at,
	legacyTables: ['users', 'users_v2', 'users_v3', 'users_v4']
});
