// import Website from "./website";
// import BotTask from "../botTask";
// import InputElement, {
//   InputType,
// } from "../../framework/src/lib/models/inputElement";

// class BotTaskMock extends BotTask {
//   execute(): Promise<void> {
//     throw new Error("Method not implemented.");
//   }
// }

// test("can get properties", () => {
//   const website = new Website({
//     botTaskType: BotTaskMock,
//     modes: [],
//     name: "Example",
//     url: "https://sleeyax.com",
//     properties: {
//       foo: "bar",
//       num: 10,
//       overwriteMe: false,
//     },
//     additionalElements: [
//       new InputElement({
//         label: "Example",
//         name: "example",
//         placeHolder: "this is an exmaple input field",
//         type: InputType.Text,
//         value: "example value",
//       }),
//       new InputElement({
//         label: "Overwrite",
//         name: "overwriteMe",
//         placeHolder: "this value can be overwritten by the user",
//         type: InputType.Dropdown,
//         value: true,
//         options: ["True", "False"],
//       }),
//     ],
//   });
//   expect(website.getProperty("foo")).toBe("bar");
//   expect(website.getProperty("num")).toBe(10);
//   expect(website.getProperty("unknown")).toBe(undefined);
//   expect(website.getProperty("example")).toBe("example value");
//   expect(website.getProperty("overwriteMe")).toBe(true);
// });
