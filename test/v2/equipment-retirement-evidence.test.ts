import { describe, expect, it } from "vitest";
import { equipmentRuleTextFingerprint as fingerprint, primaryEquipmentTextIssues, unaccountedLegacyEquipmentPaths } from "../../src/domain/equipment/equipment-retirement-evidence";
describe("source evidence for retiring translated equipment", () => {
  it("preserves signs, fractions, percentages and whole words in rule comparisons", () => {
    expect(fingerprint("+2")).not.toBe(fingerprint("-2"));
    expect(fingerprint("1/2")).not.toBe(fingerprint("12"));
    expect(fingerprint("5%")).not.toBe(fingerprint("5"));
    expect(fingerprint("fireball").includes(fingerprint("fire"))).toBe(false);
    expect(fingerprint("1d6 − 1")).toBe(fingerprint("1d6 -1"));
    expect(fingerprint("You can’t.")).toBe(fingerprint("you can't"));
  });
  it("rejects additional English powers and missing Spanish restrictions", () => {
    const evidence={englishTextParts:["+2 bonus."],englishSection:"Grants a +2 bonus.",spanishExpectedParts:["Bonificador +2.","Requiere sintonización."],spanishActualParts:["Bonificador +2.","Requiere sintonización."]};
    expect(primaryEquipmentTextIssues(evidence)).toEqual([]);
    expect(primaryEquipmentTextIssues({...evidence,englishTextParts:["-2 bonus."]})).toContain("English-text-outside-primary-section");
    expect(primaryEquipmentTextIssues({...evidence,englishTextParts:["+2 bonus. You can fly."]})).toContain("English-text-outside-primary-section");
    expect(primaryEquipmentTextIssues({...evidence,spanishActualParts:["Bonificador +2."]})).toContain("Spanish-primary-text-not-complete");
  });
  it("does not certify an empty primary section or only a partial word match", () => {
    expect(primaryEquipmentTextIssues({englishSection:"",englishTextParts:[],spanishExpectedParts:[],spanishActualParts:[]})).toEqual(["missing-primary-text"]);
    expect(primaryEquipmentTextIssues({englishSection:"Cast fireball",englishTextParts:["Cast fire"],spanishExpectedParts:["regla"],spanishActualParts:["regla"]})).toContain("English-text-outside-primary-section");
  });
  it("finds unexpected nested rules rather than treating the enclosing field as accounted for", () => {
    expect(unaccountedLegacyEquipmentPaths({name:"Item",cost:{quantity:2,unit:"gp"},properties:[{index:"heavy",name:"Heavy"}],bonus:[],chargesOptions:null})).toEqual([]);
    expect(unaccountedLegacyEquipmentPaths({bonus:[{key:"AC",value:1,otherPower:"flight"}]})).toEqual(["/bonus/0/otherPower"]);
    expect(unaccountedLegacyEquipmentPaths({description:{hiddenPower:"flight"}})).toEqual(["/description/hiddenPower"]);
  });
});
