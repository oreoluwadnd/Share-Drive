import { Platform } from 'react-native';

import AdminApp from './src/AdminApp';
import DriverApp from './src/DriverApp';

// Phones record drives; a browser opens the admin dashboard.
export default Platform.OS === 'web' ? AdminApp : DriverApp;
