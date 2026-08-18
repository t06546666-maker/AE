import { app } from './app';
import { Config } from './config';
import { Logger } from './common/logger';

const port = Config.port || 3000;

app.listen(port, () => {
  Logger.info(`🚀 Sharon Rewards Settlement Engine backend running on port ${port}`);
});
