import { connect } from 'react-redux';
import LicenseKey from '../../../../../../lib/models/licenseKey';
import { RootState } from '../../../reducers';
import MenuProfile from './MenuProfile';

const mapStateToProps = (state: RootState) => ({
    profilePicture: state.user.account?.discord.profilePicture,
    username: state.user.account?.discord.username,
    licenseType: state.user.account ? LicenseKey.getType(state.user.account.license.type) : '',
});

export default connect(mapStateToProps)(MenuProfile);
