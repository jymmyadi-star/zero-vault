import { getV2Database, purgeV2Database } from './database-v2';

export function getDatabase(): any {
  return getV2Database();
}

export { purgeV2Database as purgeDatabase };
