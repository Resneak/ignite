import { connect } from 'react-redux';
import { Dispatch } from 'redux';
import Currency from '../../../../../../lib/models/currency';
import { updateUserCurrency, UserAction } from '../../../actions/userActions';
import { RootState } from '../../../reducers';
import YourAccount from './YourAccount';

const mapStateToProps = (state: RootState) => ({
    profilePicture: state.user.account?.discord.profilePicture,
    username: state.user.account?.discord.username,
    currency: state.user.account!.currency,
});

const mapDispatchToProps = (dispatch: Dispatch<UserAction>) => ({
    updateCurrency: (currency: Currency) => dispatch(updateUserCurrency(currency)),
});

export default connect(mapStateToProps, mapDispatchToProps)(YourAccount);
