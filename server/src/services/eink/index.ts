// Side-effect imports: each panel builds its profile list, registers its own
// cron, and adds itself to the registry on load. Add a new panel's folder
// here and nowhere else - routes/eink.ts looks panels up by id.
import './panels/appliance-schedule';
