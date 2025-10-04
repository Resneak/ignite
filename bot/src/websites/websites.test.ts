// import Website from '../../lib/models/website';
// import BotTask from '../botTask';
// import Profile, { ProfilePayment, ProfileShipping } from '../../lib/models/profile';
// import Task from '../../framework/src/lib/models/task';
// import { genGuuid } from '../../framework/src/renderer/helpers';
// import Product from '../../framework/src/lib/models/product';
// import Variant from '../../lib/models/Variant';

// class BotTaskDummy extends BotTask {
//     protected execute(): Generator<Promise<void>, any, unknown> {
//         throw new Error('Method not implemented.');
//     }
// }

// const profile = new Profile({
//     createdAt: new Date(),
//     id: 'abc',
//     name: 'Foo',
//     payment: new ProfilePayment({
//         code: '721',
//         month: 1,
//         number: '4005136856338982',
//         year: 2020,
//     }),
//     sameAddress: true,
//     singleCheckout: false,
//     shippingAddress: new ProfileShipping({
//         address: 'sesamstraat',
//         city: 'Antwerp',
//         country: 'Belgium',
//         email: 'fake@mail.com',
//         firstName: 'Foo',
//         lastName: 'Bar',
//         phone: '+6666666666',
//         state: 'Chakamaka',
//         secondaryAddress: '',
//         zip: '1234',
//     }),
// });

// const product = new Product(
//     'Example Product',
//     new Variant({
//         isRandom: false,
//         value: '8.0',
//     })
// );

// const task = new Task({
//     createdAt: new Date(),
//     isActive: false,
//     checkoutDelay: 1000,
//     id: genGuuid(),
//     mode: '',
//     product,
//     profileId: genGuuid(),
//     proxyListId: genGuuid(),
//     websiteName: 'Example',
// });

// const website = new Website({
//     botTaskType: BotTaskDummy,
//     modes: ['Normal'],
//     name: 'Test',
//     url: 'https://example.com/',
//     category: 'test',
// });

// const botTask = website.createBotTask({
//     setStatus: (x, y) => console.log(x, y),
//     profile,
//     task,
//     onComplete: () => console.log('completed'),
// });

// test('can create bot task', () => {
//     expect(botTask).toBeDefined();
// });

// test('starting unimplemented bot task throws error', () => {
//     // expect.assertions(1);
//     return botTask.start().catch((e) => expect(e.toString()).toMatch('Error: Method not implemented.'));
// });
