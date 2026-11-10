// @vitest-environment happy-dom
import { afterEach, expect, it, vi } from 'vitest';
import { NextApp } from '../../src/ui/next/next-app';
import { CampaignApplication } from '../../src/application/campaign/campaign-application';
import { InMemoryCampaignRepository } from '../../src/infrastructure/persistence/in-memory-campaign-repository';
import { CampaignV2Schema, type CharacterV2 } from '../../src/domain/character/character-v2';
import { createCharacter } from '../../src/domain/character/create-character';
import { rogueCreation } from '../fixtures/rogue-builder';
import type { DiceRollRequest } from '../../src/application/ports/dice-roller';

const stamp='2026-11-08T12:00:00.000Z',id='chr_11111111111111111111111111111111';
const views:NextApp[]=[];
afterEach(()=>{for(const view of views.splice(0))view.stop();document.body.replaceChildren();localStorage.clear();});
async function fixture(configure:(c:CharacterV2)=>void=()=>{}) {
  const c=createCharacter(id,'Lira',stamp);c.combat.hitPoints={current:30,maximum:30,temporary:0};c.identity.level=1;
  c.abilities.intelligence=16;c.checks.skills.investigation.proficiency=1;configure(c);
  const repository=new InMemoryCampaignRepository();
  await repository.save(CampaignV2Schema.parse({schemaVersion:2,id:'cmp_22222222222222222222222222222222',revision:0,characters:{[id]:c},metadata:{createdAt:stamp,updatedAt:stamp}}),{kind:'empty'});
  const application=new CampaignApplication(repository),roll=vi.fn(async(_request:DiceRollRequest)=>({kind:'rolled' as const,totals:[12],summary:'12'}));
  const root=document.createElement('div');document.body.append(root);
  const view=new NextApp(root,{role:'player',loadCampaign:()=>application.loadCampaign(),play:{application,diceRoller:{roll}}});
  views.push(view);await view.start();
  const current=async()=>(await repository.load())!.campaign.characters[id]!;
  const click=async(action:string)=>{const button=[...root.querySelectorAll<HTMLButtonElement>('[data-next-play]')].find(b=>b.dataset.nextPlay===action)!;expect(button,action).toBeTruthy();expect(button.disabled,action).toBe(false);button.click();await vi.waitFor(()=>expect(root.querySelector('.next-interface')!.getAttribute('aria-busy')).toBe('false'));};
  const submit=async(kind:string,amount:number)=>{const form=root.querySelector<HTMLFormElement>(`form[data-next-form="${kind}"]`)!;const details=form.closest('details');if(details)details.open=true;form.querySelector<HTMLInputElement>('input')!.value=String(amount);form.dispatchEvent(new SubmitEvent('submit',{bubbles:true,cancelable:true}));await vi.waitFor(()=>expect(root.querySelector('.next-interface')!.getAttribute('aria-busy')).toBe('false'));};
  return {root,view,application,repository,roll,current,click,submit};
}

it('saves character color through the shared editor once and keeps it after navigation and reload',async()=>{
  const s=await fixture();
  const edit=vi.spyOn(s.application,'editCharacter');
  const form=s.root.querySelector<HTMLFormElement>('[data-next-form="color"]')!;
  form.querySelector<HTMLInputElement>('input')!.value='#6f96c4';
  form.dispatchEvent(new SubmitEvent('submit',{bubbles:true,cancelable:true}));
  form.dispatchEvent(new SubmitEvent('submit',{bubbles:true,cancelable:true}));
  await vi.waitFor(()=>expect(s.root.querySelector('.next-interface')!.getAttribute('aria-busy')).toBe('false'));
  expect(edit).toHaveBeenCalledTimes(1);
  expect(edit.mock.calls[0]![0]).toMatchObject({characterId:id,expectedCharacterRevision:0,patch:{color:'#6f96c4'}});
  expect((await s.current()).color).toBe('#6f96c4');
  s.root.querySelector<HTMLButtonElement>('[data-next-section="equipment"]')!.click();
  expect(s.root.querySelector<HTMLSelectElement>('#character-title-select')!.selectedOptions[0]!.style.color).toBe('#6f96c4');
  s.view.stop();
  const reloaded=new NextApp(s.root,{role:'player',loadCampaign:()=>s.application.loadCampaign()});
  views.push(reloaded);await reloaded.start();
  expect(s.root.querySelector<HTMLInputElement>('[name="color"]')!.value).toBe('#6f96c4');
  expect(s.roll).not.toHaveBeenCalled();
});

it('refreshes a conflicting color save without overwriting a remote character edit',async()=>{
  const s=await fixture(),base=(await s.repository.load())!,c=await s.current();
  await s.application.editCharacter({characterId:id,expectedCharacterRevision:c.revision,expectedCampaignChecksum:base.checksum,patch:{color:'#79a879',identity:{experience:25}}});
  const form=s.root.querySelector<HTMLFormElement>('[data-next-form="color"]')!;
  form.querySelector<HTMLInputElement>('input')!.value='#6f96c4';
  form.dispatchEvent(new SubmitEvent('submit',{bubbles:true,cancelable:true}));
  await vi.waitFor(()=>expect(s.root.querySelector('.next-interface')!.getAttribute('aria-busy')).toBe('false'));
  expect(await s.current()).toMatchObject({color:'#79a879',identity:{experience:25}});
  expect(s.root.querySelector('[role="status"]')).toBeTruthy();
  expect(s.root.querySelector<HTMLInputElement>('[name="color"]')!.value).toBe('#79a879');
});

it('adds XP, measures progress within the level, highlights the threshold and never auto-levels',async()=>{
  const s=await fixture();
  await s.submit('experience',150);
  expect((await s.current()).identity).toMatchObject({level:1,experience:150});
  expect(s.root.querySelector('[role="progressbar"]')!.getAttribute('aria-valuenow')).toBe('150');
  expect(s.root.querySelector('.ns-level-badge')!.getAttribute('style')).toContain('50%');
  await s.submit('experience',150);
  expect(s.root.querySelector('.ns-level-ready')).toBeTruthy();
  expect(s.root.querySelector<HTMLButtonElement>('[data-next-play="level-up"]')!.disabled).toBe(true); // Legacy sheet has no builder.
  expect((await s.current()).identity.level).toBe(1);
  await s.submit('experience',-1);
  expect((await s.current()).identity.experience).toBe(300);
  expect(s.root.querySelector('[role="status"]')!.textContent).toContain('positiva');
});

it('keeps XP details folded behind the ring, with hover help and keyboard dismissal without writes',async()=>{
  const s=await fixture(c=>{c.identity.experience=150;});
  const save=vi.spyOn(s.repository,'save');
  const details=s.root.querySelector<HTMLDetailsElement>('.ns-level-details')!,ring=details.querySelector<HTMLElement>('summary')!;
  expect(s.root.querySelector('.ns-vitals')!.firstElementChild!.classList.contains('ns-level')).toBe(true);
  expect(s.root.querySelector('.ns-quick .ns-inspiration')).toBeTruthy();
  expect(s.root.querySelector('.ns-context .ns-roll-modes')).toBeTruthy();
  expect(details.open).toBe(false);
  expect(s.root.querySelector('form[data-next-form="experience"]')!.closest('details')).toBe(details);
  ring.focus();expect(s.root.querySelector('[role="tooltip"]')!.textContent).toContain('150 PX actuales · Faltan 150 PX');
  ring.click();expect(details.open).toBe(true);
  const input=details.querySelector<HTMLInputElement>('input')!;input.focus();
  input.dispatchEvent(new KeyboardEvent('keydown',{key:'Escape',bubbles:true}));
  expect(details.open).toBe(false);expect(document.activeElement).toBe(ring);
  expect(s.root.querySelector<HTMLElement>('[role="tooltip"]')!.hidden).toBe(true);
  ring.click();expect(details.open).toBe(true);
  s.root.querySelector<HTMLElement>('.ns-vital-ca')!.click();expect(details.open).toBe(false);
  expect(save).not.toHaveBeenCalled();
});

it('handles inspiration activation, local arming, deactivation and consumption on one compatible roll',async()=>{
  const s=await fixture();
  await s.click('inspiration');expect((await s.current()).combat.inspiration).toBe(true);
  expect(s.root.querySelector('.ns-inspiration')!.textContent).toBe('InspiraciónDisponible');
  expect(s.root.querySelector('.ns-inspiration')!.getAttribute('data-inspiration-state')).toBe('available');
  expect(s.root.querySelector('.ns-inspiration')!.classList.contains('ns-inspired')).toBe(true);
  await s.click('inspiration');expect(s.root.querySelector('.ns-inspiration')!.getAttribute('aria-pressed')).toBe('true');
  expect(s.root.querySelector('.ns-inspiration')!.textContent).toBe('InspiraciónEn uso');
  expect(s.root.querySelector('.ns-inspiration')!.classList.contains('ns-armed')).toBe(true);
  await s.click('inspiration');expect((await s.current()).combat.inspiration).toBe(false);
  await s.click('inspiration');await s.click('inspiration');
  await s.click('roll:skill/investigation');
  expect(s.roll).toHaveBeenCalledExactlyOnceWith(expect.objectContaining({expressions:['1d20+5'],mode:'advantage'}));
  expect((await s.current()).combat.inspiration).toBe(false);
  expect(s.root.querySelector('.ns-inspiration')!.textContent).toBe('InspiraciónInactiva');
  expect(s.root.querySelector('.ns-inspiration')!.classList.contains('ns-inspired')).toBe(false);
  expect(s.root.querySelector('[role="status"]')).toBeNull();
});

it('consumes an unlocked mode, preserves a locked mode, cancels opposite modes and unlocks again',async()=>{
  const s=await fixture();
  await s.click('mode:advantage');await s.click('roll:skill/history');await s.click('roll:save/intelligence');
  expect(s.roll.mock.calls.map(call=>Reflect.get(call[0]??{},'mode'))).toEqual(['advantage','normal']);
  await s.click('mode:disadvantage');await s.click('lock:disadvantage');
  await s.click('inspiration');await s.click('inspiration');
  await s.click('roll:skill/history'); // Inspired advantage cancels the manual disadvantage.
  await s.click('roll:skill/history');
  expect(s.roll.mock.calls.map(call=>Reflect.get(call[0]??{},'mode'))).toEqual(['advantage','normal','normal','disadvantage']);
  await s.click('lock:disadvantage');await s.click('roll:ability/intelligence');await s.click('roll:skill/history');
  expect(s.roll.mock.calls.map(call=>Reflect.get(call[0]??{},'mode')).slice(-2)).toEqual(['disadvantage','normal']);
});

it('keeps inspiration and the next-roll mode when the dice request fails and suppresses repeated clicks',async()=>{
  const s=await fixture();await s.click('inspiration');await s.click('inspiration');await s.click('mode:advantage');
  s.roll.mockRejectedValueOnce(new Error('Bandeja no disponible'));
  await s.click('roll:skill/history');
  expect((await s.current()).combat.inspiration).toBe(true);
  expect(s.root.querySelector('[data-next-play="mode:advantage"]')!.getAttribute('aria-pressed')).toBe('true');
  let resolve!:()=>void;s.roll.mockImplementationOnce(()=>new Promise(done=>{resolve=()=>done({kind:'rolled',totals:[12],summary:'12'});}));
  s.root.querySelector<HTMLButtonElement>('[data-next-play="roll:skill/history"]')!.click();
  expect(await s.view.savePendingChanges()).toBe(false);
  const busy=s.root.querySelector<HTMLButtonElement>('[data-next-play="roll:skill/history"]')!;busy.disabled=false;busy.click();
  resolve();await vi.waitFor(()=>expect(s.root.querySelector('.next-interface')!.getAttribute('aria-busy')).toBe('false'));
  expect(s.roll).toHaveBeenCalledTimes(2);expect((await s.current()).combat.inspiration).toBe(false);
});

it('shows death saves only at zero, blocks other actions and restores one HP atomically after three successes',async()=>{
  const s=await fixture(c=>{c.combat.hitPoints.current=0;});
  expect(s.root.querySelectorAll('.ns-death-mark')).toHaveLength(6);
  for(const button of s.root.querySelectorAll<HTMLButtonElement>('.ns-check,[data-next-play="inspiration"],[data-next-play^="mode:"]'))expect(button.disabled).toBe(true);
  const save=vi.spyOn(s.repository,'save');
  const forged=s.root.querySelector<HTMLButtonElement>('[data-next-play="inspiration"]')!;forged.disabled=false;forged.click();
  expect(save).not.toHaveBeenCalled();
  await s.click('death:success');await s.click('death:success');
  expect((await s.current()).combat.hitPoints.current).toBe(0);
  await s.click('death:success');
  const c=await s.current();expect(c.combat.hitPoints.current).toBe(1);expect(c.combat.deathSaves).toEqual({successes:0,failures:0});
  expect(save).toHaveBeenCalledTimes(3); // No second heal command.
  expect(s.root.querySelector('.ns-death')).toBeNull();
  expect(s.root.querySelector<HTMLButtonElement>('[data-next-play="inspiration"]')!.disabled).toBe(false);
  expect(s.roll).not.toHaveBeenCalled();
});

it('does not reroll or automatically reuse inspiration when consuming it conflicts with a remote edit',async()=>{
  const s=await fixture();await s.click('inspiration');await s.click('inspiration');
  s.roll.mockImplementationOnce(async()=>{
    const snapshot=(await s.repository.load())!,c=snapshot.campaign.characters[id]!;
    await s.application.editCharacter({characterId:id,expectedCharacterRevision:c.revision,expectedCampaignChecksum:snapshot.checksum,patch:{identity:{experience:10}}});
    return {kind:'rolled',totals:[12],summary:'12'};
  });
  await s.click('roll:skill/history');
  expect(s.roll).toHaveBeenCalledTimes(1);
  expect((await s.current()).combat.inspiration).toBe(true);
  expect((await s.current()).identity.experience).toBe(10);
  expect(s.root.querySelector('[role="status"]')).toBeTruthy();
  expect(s.root.querySelector('.ns-inspiration')!.getAttribute('data-inspiration-state')).toBe('available');
  await s.click('roll:skill/history');
  expect(s.roll.mock.calls[1]![0].mode).toBe('normal');
});

it('records failures and reset, caps the counters and permits healing in the zero-HP state',async()=>{
  const s=await fixture(c=>{c.combat.hitPoints.current=0;});
  await s.click('death:failure');await s.click('death:reset');
  expect((await s.current()).combat.deathSaves.failures).toBe(0);
  for(let i=0;i<3;i++)await s.click('death:failure');
  expect(s.root.querySelector<HTMLButtonElement>('[data-next-play="death:failure"]')!.disabled).toBe(true);
  await s.submit('heal',8);
  expect((await s.current()).combat.hitPoints.current).toBe(8);
  expect((await s.current()).combat.deathSaves).toEqual({successes:0,failures:0});
  expect(s.root.querySelector('.ns-death')).toBeNull();
});

it('opens the existing guided level-up and cancellation leaves campaign data unchanged',async()=>{
  const s=await fixture();let snapshot=(await s.repository.load())!;
  snapshot=await s.application.createGuidedCharacter({operationId:'build_33333333333333333333333333333333',creation:rogueCreation(),expectedCampaignChecksum:snapshot.checksum});
  const c=Object.values(snapshot.campaign.characters).find(c=>!!c.builder)!;
  await s.application.editCharacter({characterId:c.id,expectedCharacterRevision:c.revision,expectedCampaignChecksum:snapshot.checksum,patch:{identity:{experience:300}}});
  s.view.stop();
  const view=new NextApp(s.root,{role:'player',loadCampaign:()=>s.application.loadCampaign(),play:{application:s.application,diceRoller:{roll:s.roll}}});views.push(view);await view.start();
  const select=s.root.querySelector<HTMLSelectElement>('#character-title-select')!;select.value=c.id;select.dispatchEvent(new Event('change',{bubbles:true}));
  const before=(await s.repository.load())!.checksum;
  await s.click('level-up');
  expect(document.querySelector('#character-builder-title')!.textContent).toBe('Subir de nivel');
  document.querySelector<HTMLButtonElement>('[data-builder-discard]')!.click();
  expect((await s.repository.load())!.checksum).toBe(before);
});
