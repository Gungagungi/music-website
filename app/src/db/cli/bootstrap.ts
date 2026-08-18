import { bootstrap } from '@/db/bootstrap';
import { runCommand } from '@/db/cli/run';

runCommand('préparation de la base', bootstrap);
