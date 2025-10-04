import { connect } from 'react-redux';
import { Dispatch } from 'redux';

import { addProfile, deleteProfile, ProfileAction, updateProfile } from '../../../actions/profileActions';
import Profile from '../../../../../../lib/models/Profile';
import Profiles from './Profiles';
import { RootState } from '../../../reducers';

const mapStateToProps = (state: RootState) => ({
    profiles: state.profile.profiles,
});

const mapDispatchToProps = (dispatch: Dispatch<ProfileAction>) => ({
    addProfile: (profile: Profile) => dispatch(addProfile(profile)),
    deleteProfile: (id: string) => dispatch(deleteProfile(id)),
    updateProfile: (profile: Profile) => dispatch(updateProfile(profile)),
});

export default connect(mapStateToProps, mapDispatchToProps)(Profiles);
