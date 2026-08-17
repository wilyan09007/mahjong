import { listen } from '@colyseus/tools';
import appConfig from './app.config.js';

/**
 * Development / production entrypoint.
 *
 * Games live in memory, so this process is the game. Exactly one instance ever
 * runs (see fly.toml): a second one would hold rooms the first cannot see, and
 * a restart ends every table in progress. That is an accepted v1 limitation,
 * written down here so it is not rediscovered in an incident.
 */
await listen(appConfig, Number(process.env['PORT'] ?? 2567));
