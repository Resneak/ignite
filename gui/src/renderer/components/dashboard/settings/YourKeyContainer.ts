import { connect } from 'react-redux';
import { RootState } from '../../../reducers';
import YourKey from './YourKey';

const mapStateToProps = (state: RootState) => ({
    license: state.user.account?.license,
});

export default connect(mapStateToProps)(YourKey);
