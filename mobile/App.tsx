import { Platform } from 'react-native';

import DriverApp from './src/DriverApp';
import WebApp from './src/WebApp';

// Phones record drives; a browser opens the landing page and the admin dashboard.
export default Platform.OS === 'web' ? WebApp : DriverApp;
