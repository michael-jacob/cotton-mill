import * as THREE from 'three';
import { act, game, toggleSound, useUI, type Selection } from '../game';
import { millWidth, moveMachine, moveProblem, placeMachine, placeProblem, sitePlan, type SitePlan } from '../sim/actions';
import { MACHINES, MILLS, MILL_IDS, siteId, type MachineType, type MillId, type SiteId } from '../sim/machines';
import { limitOf, limitReason, type Limit } from '../sim/report';
import type { MachineInst } from '../sim/state';
import { buildEngine, type Engine } from './engine';
import { FlowLayer } from './flow';
import { BUILDERS } from './machines';
import { M, V, belt, beltTexture, disposeTree, optimizeModel, shadows, spokedWheel, type MachineModel, type PartLabel } from './parts';
import { LINE_RATIO, PT, buildPowerTrain, type PowerTrain } from './powertrain';
import { buildCottage, buildGround, buildHousing, buildMillFloor, buildRoof, buildTransport, buildYard, type Building, type Ground, type TransportView, type Yard } from './world';
import { sound } from '../audio';
import { COTTAGE, FLOOR_H, alleyRects } from '../sim/machines';

const TAU = Math.PI * 2;
const VIEW_H = 40; // world units visible vertically at zoom 1
const ELEV = Math.atan(1 / Math.SQRT2); // true isometric elevation
const CAM_DIST = 180;

interface View {
  inst: MachineInst;
  /** where the machine stood when this view was built: a move changes it, and the view is rebuilt */
  at: string;
  model: MachineModel;
  plan: SitePlan;
  t: number;
  speed: number;
  belt?: THREE.Mesh;
  drum?: THREE.Object3D;
}

/** Everything drawn for one mill: its storeys, shafting and engine house. */
interface MillView {
  id: MillId;
  root: THREE.Group;
  floors: Building[];
  power: PowerTrain;
  engine: Engine | null;
  roof: THREE.Group;
  key: string;
  /** wheel-equivalent angle driving all the shafting */
  angle: number;
  speed: number;
}

const placeKey = (m: MachineInst) => `${m.type}|${m.site}|${m.x}|${m.z}|${m.flip ? 1 : 0}`;

/** Where a machine is set up for the encyclopedia. */
const EXHIBIT = { x: 300, z: 0 };

interface Spot {
  site: SiteId;
  x: number;
  z: number;
}

export class FactoryScene {
  private renderer: THREE.WebGLRenderer;
  private scene = new THREE.Scene();
  private camera = new THREE.OrthographicCamera(-1, 1, 1, -1, 0.1, 700);
  private target = V(10.5, 0, 16);
  private az = -Math.PI / 4;
  private azGoal = -Math.PI / 4;
  private zoom = 3;
  private zoomGoal = 3;
  private targetGoal: THREE.Vector3 | null = null;

  private ground: Ground;
  private yard: Yard;
  private cottage: Building;
  private mills = new Map<MillId, MillView>();
  private plot: THREE.Object3D;
  private views = new Map<number, View>();

  private ghost: THREE.Mesh;
  private ghostOk = new THREE.MeshBasicMaterial({ color: 0x4caf50, transparent: true, opacity: 0.35, depthWrite: false });
  private ghostBad = new THREE.MeshBasicMaterial({ color: 0xd9534f, transparent: true, opacity: 0.35, depthWrite: false });
  private ghostAt: Spot | null = null;
  /** strips showing the alleys the machine being placed would need */
  private ghostAlleys: THREE.Mesh[] = [];
  private selBox: THREE.LineSegments;
  private ray = new THREE.Raycaster();
  private frameNo = 0;
  private keys = new Set<string>();
  private labelEls: HTMLDivElement[] = [];
  /** markers over machines that are held up */
  private statusEls: HTMLDivElement[] = [];
  private flow = new FlowLayer();
  private flowDirty = true;
  private clock = 0;
  private cottageRoof: THREE.Group;
  private housing: THREE.Group | null = null;
  private housingRows = -1;
  /** 0 = roofs on, 1 = lifted clear and hidden */
  private roofLift = 1;
  private transport: TransportView;
  /** a machine set up on its own for the encyclopedia, away from the works */
  private exhibit: { type: MachineType; model: MachineModel; t: number } | null = null;
  private exhibitStand = new THREE.Group();
  private saved: { target: THREE.Vector3; zoom: number } | null = null;
  /** flames shown for a few seconds after a fire */
  private flames = new THREE.Group();
  private flameUntil = 0;
  private seenFire = -1;

  constructor(private container: HTMLElement, private labelLayer: HTMLElement) {
    this.renderer = new THREE.WebGLRenderer({ antialias: true });
    this.renderer.setPixelRatio(Math.min(window.devicePixelRatio, 2));
    this.renderer.shadowMap.enabled = true;
    this.renderer.shadowMap.type = THREE.PCFSoftShadowMap;
    this.renderer.shadowMap.autoUpdate = false;
    container.appendChild(this.renderer.domElement);
    this.scene.background = new THREE.Color(0xd6cdb4);

    this.scene.add(new THREE.HemisphereLight(0xfff6e0, 0x6b6250, 1.15));
    const sun = new THREE.DirectionalLight(0xfff1d6, 2.4);
    sun.position.set(-8, 44, 26);
    sun.target.position.set(20, 0, 0);
    sun.castShadow = true;
    sun.shadow.mapSize.set(4096, 4096);
    const sc = sun.shadow.camera;
    sc.left = -42;
    sc.right = 42;
    sc.top = 36;
    sc.bottom = -36;
    sc.near = 1;
    sc.far = 150;
    sun.shadow.bias = -0.0005;
    sun.shadow.normalBias = 0.03;
    this.scene.add(sun, sun.target);

    this.ground = buildGround();
    this.scene.add(this.ground.group);
    this.yard = buildYard();
    this.scene.add(this.yard.group);
    this.cottage = buildCottage();
    this.scene.add(this.cottage.group);
    this.cottageRoof = buildRoof(COTTAGE.w, COTTAGE.d, 0.28, 1.5);
    this.cottage.group.add(this.cottageRoof);
    for (const o of [this.ground.group, this.yard.group, this.cottage.group]) shadows(o);
    this.scene.add(this.flow.group);
    this.transport = buildTransport();
    shadows(this.transport.group);
    this.scene.add(this.transport.group);
    // the exhibition stand: a round plinth far from the works
    this.exhibitStand.position.set(EXHIBIT.x, 0, EXHIBIT.z);
    const plinth = new THREE.Mesh(new THREE.CylinderGeometry(4.2, 4.4, 0.3, 48), M.boards);
    plinth.position.y = -0.16;
    this.exhibitStand.add(plinth);
    this.exhibitStand.visible = false;
    this.scene.add(this.exhibitStand);
    for (let i = 0; i < 7; i++) {
      const f = new THREE.Mesh(new THREE.SphereGeometry(0.9, 10, 8), i % 2 ? M.fire : M.smoke.clone());
      this.flames.add(f);
    }
    this.flames.visible = false;
    this.scene.add(this.flames);

    // staked-out plot shown before the first mill is built
    const md = MILLS.mill;
    const plotGeo = new THREE.EdgesGeometry(new THREE.BoxGeometry(md.baseW, 0.02, md.d));
    const plot = new THREE.LineSegments(plotGeo, new THREE.LineDashedMaterial({ color: 0x4a3a22, dashSize: 0.5, gapSize: 0.3 }));
    plot.computeLineDistances();
    plot.position.set(md.ox + md.baseW / 2, 0.03, md.oz + md.d / 2);
    this.plot = plot;
    this.scene.add(plot);

    this.ghost = new THREE.Mesh(new THREE.BoxGeometry(1, 1, 1), this.ghostOk);
    this.ghost.visible = false;
    this.ghost.renderOrder = 5;
    this.scene.add(this.ghost);
    const alleyMat = new THREE.MeshBasicMaterial({ color: 0xffd54a, transparent: true, opacity: 0.4, depthWrite: false });
    for (let i = 0; i < 2; i++) {
      const a = new THREE.Mesh(new THREE.BoxGeometry(1, 1, 1), alleyMat);
      a.visible = false;
      a.renderOrder = 5;
      this.scene.add(a);
      this.ghostAlleys.push(a);
    }
    this.selBox = new THREE.LineSegments(
      new THREE.EdgesGeometry(new THREE.BoxGeometry(1, 1, 1)),
      new THREE.LineBasicMaterial({ color: 0xffd54a, depthTest: false }),
    );
    this.selBox.renderOrder = 6;
    this.selBox.visible = false;
    this.scene.add(this.selBox);

    this.bindInput();
    new ResizeObserver(() => this.resize()).observe(container);
    this.resize();
    this.placeCamera();
  }

  // ---------- mills ----------

  /** (Re)build any mill whose shape no longer matches the game state. */
  private syncMills(): void {
    const s = game.state;
    for (const id of MILL_IDS) {
      const ms = s.mills[id];
      const w = millWidth(s, id);
      const key = ms.built ? `${w}|${ms.floors}|${ms.engine}|${ms.engine2}` : '';
      const old = this.mills.get(id);
      if ((old?.key ?? '') === key) continue;
      // machines in the mill hang drums on its line shafts, so their views must be rebuilt too
      for (const [vid, v] of this.views) if (v.plan.mill === id) this.dropView(vid, v);
      if (old) {
        this.scene.remove(old.root);
        disposeTree(old.root);
      }
      this.mills.delete(id);
      if (!ms.built) continue;
      const def = MILLS[id];
      const root = new THREE.Group();
      root.position.set(def.ox, 0, def.oz);
      const floors: Building[] = [];
      for (let f = 0; f < ms.floors; f++) {
        const b = buildMillFloor(w, def.d, f);
        floors.push(b);
        root.add(b.group);
      }
      const power = buildPowerTrain(w, ms.floors, def.wheel);
      root.add(power.group);
      let engine: Engine | null = null;
      if (ms.engine) {
        engine = buildEngine(w, ms.engine2, id === 'mill2');
        power.lineShafts[0].add(engine.pinion);
        root.add(engine.group);
      }
      const roof = buildRoof(w, def.d, 0.35, 2.2);
      root.add(roof);
      shadows(root);
      this.scene.add(root);
      this.mills.set(id, { id, root, floors, power, engine, roof, key, angle: old?.angle ?? 0, speed: 0 });
    }
  }

  // ---------- camera ----------

  private resize(): void {
    const w = this.container.clientWidth || 1;
    const h = this.container.clientHeight || 1;
    this.renderer.setSize(w, h);
    const aspect = w / h;
    this.camera.left = (-VIEW_H * aspect) / 2;
    this.camera.right = (VIEW_H * aspect) / 2;
    this.camera.top = VIEW_H / 2;
    this.camera.bottom = -VIEW_H / 2;
    this.camera.updateProjectionMatrix();
  }

  private camDir(): THREE.Vector3 {
    return V(Math.cos(ELEV) * Math.sin(this.az), Math.sin(ELEV), Math.cos(ELEV) * Math.cos(this.az));
  }

  private placeCamera(): void {
    this.camera.position.copy(this.target).addScaledVector(this.camDir(), CAM_DIST);
    this.camera.lookAt(this.target);
    this.camera.zoom = this.zoom;
    this.camera.updateProjectionMatrix();
    this.camera.updateMatrixWorld();
  }

  rotate(dir: 1 | -1): void {
    this.azGoal += (dir * Math.PI) / 2;
  }

  zoomBy(f: number): void {
    this.zoomGoal = Math.max(0.5, Math.min(16, this.zoomGoal * f));
  }

  focus(sel: Selection): void {
    const b = this.boundsOf(sel);
    if (!b) return;
    this.targetGoal = b.getCenter(V());
    const size = b.getSize(V());
    this.zoomGoal = Math.max(1.5, Math.min(14, VIEW_H / (Math.max(size.x, size.y, size.z) * 1.45)));
  }

  /** Move the view to a point on the ground. */
  lookAt(x: number, z: number, zoom: number): void {
    this.targetGoal = V(x, 0, z);
    this.zoomGoal = zoom;
  }

  private setRay(clientX: number, clientY: number): void {
    const r = this.renderer.domElement.getBoundingClientRect();
    const ndc = new THREE.Vector2(((clientX - r.left) / r.width) * 2 - 1, -((clientY - r.top) / r.height) * 2 + 1);
    this.ray.setFromCamera(ndc, this.camera);
  }

  private groundPoint(clientX: number, clientY: number, y = 0): THREE.Vector3 | null {
    this.setRay(clientX, clientY);
    const p = V();
    return this.ray.ray.intersectPlane(new THREE.Plane(V(0, 1, 0), -y), p) ? p : null;
  }

  // ---------- input ----------

  private bindInput(): void {
    const el = this.renderer.domElement;
    let down: { x: number; y: number; moved: boolean } | null = null;

    el.addEventListener('pointerdown', (e) => {
      down = { x: e.clientX, y: e.clientY, moved: false };
      el.setPointerCapture(e.pointerId);
    });
    el.addEventListener('pointermove', (e) => {
      if (down) {
        const dx = e.clientX - down.x;
        const dy = e.clientY - down.y;
        if (!down.moved && Math.hypot(dx, dy) > 4) down.moved = true;
        if (down.moved) {
          const upp = VIEW_H / (this.zoom * el.clientHeight);
          const right = V(Math.cos(this.az), 0, -Math.sin(this.az));
          const fwd = V(-Math.sin(this.az), 0, -Math.cos(this.az));
          this.target.addScaledVector(right, -dx * upp).addScaledVector(fwd, (dy * upp) / Math.sin(ELEV));
          this.targetGoal = null;
          down.x = e.clientX;
          down.y = e.clientY;
        }
      } else {
        this.hover(e.clientX, e.clientY);
      }
    });
    el.addEventListener('pointerup', (e) => {
      const wasDrag = down?.moved;
      down = null;
      if (wasDrag) return;
      if (e.button === 2) {
        useUI.setState({ placing: null, moving: null, placeHint: null });
        return;
      }
      this.click(e.clientX, e.clientY);
    });
    el.addEventListener('contextmenu', (e) => e.preventDefault());
    el.addEventListener('pointerleave', () => {
      this.ghostAt = null;
    });
    el.addEventListener(
      'wheel',
      (e) => {
        e.preventDefault();
        const before = this.groundPoint(e.clientX, e.clientY);
        this.zoomGoal = Math.max(0.5, Math.min(16, this.zoomGoal * Math.exp(-e.deltaY * 0.0016)));
        this.zoom = this.zoomGoal;
        this.placeCamera();
        const after = this.groundPoint(e.clientX, e.clientY);
        if (before && after) this.target.add(before.sub(after));
        this.targetGoal = null;
      },
      { passive: false },
    );
    window.addEventListener('keydown', (e) => {
      if ((e.target as HTMLElement).tagName === 'INPUT' || (e.target as HTMLElement).tagName === 'SELECT') return;
      const k = e.key.toLowerCase();
      this.keys.add(k);
      if (k === 'q') this.rotate(-1);
      else if (k === 'e') this.rotate(1);
      else if (k === 'escape') useUI.setState((s) => (s.placing ? { placing: null, moving: null, placeHint: null } : s.panel ? { panel: null } : { selected: null }));
      else if (k === ' ') {
        e.preventDefault();
        useUI.setState((s) => ({ speed: s.speed === 0 ? 1 : 0 }));
      } else if (k === 'f') {
        const u = useUI.getState();
        if (u.selected !== null) {
          useUI.setState({ isolate: !u.isolate });
          if (!u.isolate) this.focus(u.selected);
        }
      } else if (k === '1' || k === '2' || k === '3') useUI.setState({ viewLevel: Number(k) - 1 });
      else if (k === 'm') toggleSound();
      else if (k === 't') useUI.setState((s) => ({ flip: !s.flip, placeHint: s.placing && this.ghostAt ? null : s.placeHint }));
      else if (k === 'r') useUI.setState((s) => ({ roofs: !s.roofs, isolate: false }));
    });
    window.addEventListener('keyup', (e) => this.keys.delete(e.key.toLowerCase()));
    window.addEventListener('blur', () => this.keys.clear());
  }

  /** The storey of a mill that is uppermost in the present view. */
  private topFloor(id: MillId): number {
    return Math.min(useUI.getState().viewLevel, game.state.mills[id].floors - 1);
  }

  /** The floor tile under the pointer: the workshop, or the uppermost visible storey of a mill. */
  private siteAt(clientX: number, clientY: number, type: MachineType): Spot | null {
    const def = MACHINES[type];
    const sites: SiteId[] = ['cottage'];
    for (const id of MILL_IDS) if (game.state.mills[id].built) sites.push(siteId(id, this.topFloor(id)));
    let best: Spot | null = null;
    let bestD = Infinity;
    for (const site of sites) {
      const plan = sitePlan(game.state, site);
      const p = this.groundPoint(clientX, clientY, plan.oy);
      if (!p) continue;
      const lx = p.x - plan.ox;
      const lz = p.z - plan.oz;
      if (lx < -1 || lz < -1 || lx > plan.w + 1 || lz > plan.d + 1) continue;
      const d = p.distanceTo(this.ray.ray.origin);
      if (d >= bestD) continue;
      bestD = d;
      best = {
        site,
        x: Math.max(plan.minX, Math.min(plan.maxX - def.w, Math.round(lx - def.w / 2))),
        z: Math.max(0, Math.min(plan.d - def.d, Math.round(lz - def.d / 2))),
      };
    }
    return best;
  }

  private hover(cx: number, cy: number): void {
    const { placing } = useUI.getState();
    if (!placing) {
      this.ghostAt = null;
      return;
    }
    this.ghostAt = this.siteAt(cx, cy, placing);
    const hint = this.ghostAt ? this.problemAt(this.ghostAt) : null;
    if (hint !== useUI.getState().placeHint) useUI.setState({ placeHint: hint });
  }

  private click(cx: number, cy: number): void {
    const ui = useUI.getState();
    if (ui.placing) {
      const at = this.siteAt(cx, cy, ui.placing);
      if (!at) return;
      if (ui.moving !== null) {
        // setting an existing machine down in its new place ends the move
        const id = ui.moving;
        if (act((s) => moveMachine(s, id, at.site, at.x, at.z, ui.flip))) {
          this.ghostAt = null;
          useUI.setState({ placing: null, moving: null, placeHint: null, selected: id });
        }
      } else {
        const m = act((s) => placeMachine(s, ui.placing!, at.site, at.x, at.z, ui.flip));
        if (m) this.hover(cx, cy);
      }
      return;
    }
    // pick the nearest machine, engine or wheel under the pointer
    this.setRay(cx, cy);
    let best: Selection = null;
    let bestD = Infinity;
    const hit = V();
    const consider = (sel: Selection) => {
      const b = this.boundsOf(sel);
      if (b && this.ray.ray.intersectBox(b, hit)) {
        const d = hit.distanceTo(this.ray.ray.origin);
        if (d < bestD) {
          bestD = d;
          best = sel;
        }
      }
    };
    // only machines on the storey you are looking down into can be picked
    for (const v of this.views.values()) if (this.onShownStorey(v.plan)) consider(v.inst.id);
    if (this.mills.has('mill')) consider('power');
    for (const mv of this.mills.values()) if (mv.engine) consider(`engine:${mv.id}`);
    useUI.setState({ selected: best, isolate: best !== null && best === ui.selected && ui.isolate });
  }

  /** Why the machine being placed (or moved) cannot go at a spot, or null if it can. */
  private problemAt(at: Spot): string | null {
    const ui = useUI.getState();
    if (!ui.placing) return null;
    return ui.moving !== null ? moveProblem(game.state, ui.moving, at.site, at.x, at.z, ui.flip) : placeProblem(game.state, ui.placing, at.site, at.x, at.z, ui.flip);
  }

  /** Whether a floor is the one in view: the workshop, or the uppermost storey shown of a mill. */
  private onShownStorey(plan: SitePlan): boolean {
    if (useUI.getState().roofs) return false;
    return plan.mill === null || plan.floor === this.topFloor(plan.mill);
  }

  private floorShown(plan: SitePlan): boolean {
    if (useUI.getState().roofs) return false; // the buildings are closed up
    return plan.mill === null || plan.floor <= useUI.getState().viewLevel;
  }

  private engineOf(sel: Selection): MillView | null {
    if (typeof sel !== 'string' || !sel.startsWith('engine:')) return null;
    const mv = this.mills.get(sel.slice(7) as MillId);
    return mv?.engine ? mv : null;
  }

  private boundsOf(sel: Selection): THREE.Box3 | null {
    if (sel === null) return null;
    if (sel === 'power') return this.mills.get('mill')?.power.bounds ?? null;
    if (typeof sel === 'string') {
      const mv = this.engineOf(sel);
      return mv ? mv.engine!.bounds.clone().translate(mv.root.position) : null;
    }
    const v = this.views.get(sel);
    if (!v) return null;
    const def = MACHINES[v.inst.type];
    const x = v.plan.ox + v.inst.x;
    const z = v.plan.oz + v.inst.z;
    return new THREE.Box3(V(x, v.plan.oy, z), V(x + def.w, v.plan.oy + v.model.height, z + def.d));
  }

  /** Set a machine up on the exhibition stand (or clear it with null). */
  private syncExhibit(type: MachineType | null): void {
    if ((this.exhibit?.type ?? null) === type) return;
    if (this.exhibit) {
      this.exhibitStand.remove(this.exhibit.model.group);
      disposeTree(this.exhibit.model.group);
    }
    this.exhibit = null;
    this.exhibitStand.visible = !!type;
    if (!type) {
      if (this.saved) {
        this.target.copy(this.saved.target);
        this.zoom = this.zoomGoal = this.saved.zoom;
        this.saved = null;
      }
      return;
    }
    const model = BUILDERS[type]();
    optimizeModel(model, type);
    this.exhibitStand.add(model.group);
    this.exhibit = { type, model, t: 0 };
    if (!this.saved) this.saved = { target: this.target.clone(), zoom: this.zoomGoal };
    this.targetGoal = null;
    this.target.set(EXHIBIT.x - 1.2, model.height * 0.45, EXHIBIT.z);
    this.zoom = this.zoomGoal = Math.min(11, VIEW_H / (Math.max(MACHINES[type].w, MACHINES[type].d, model.height) * 2.1));
  }

  /** Where the selected machine's material comes from and its product goes, in words. */
  suppliesOf(sel: Selection) {
    return typeof sel === 'number' ? this.flow.describe(sel) : [];
  }

  /** Part labels of the machine on the exhibition stand. */
  exhibitLabels(): PartLabel[] {
    return this.exhibit?.model.labels ?? [];
  }

  /** Part labels for the current selection, for the inspector's legend. */
  labelsFor(sel: Selection): PartLabel[] {
    if (this.exhibit) return this.exhibit.model.labels;
    if (sel === null) return [];
    if (sel === 'power') return this.mills.get('mill')?.power.labels ?? [];
    if (typeof sel === 'string') return this.engineOf(sel)?.engine!.labels ?? [];
    return this.views.get(sel)?.model.labels ?? [];
  }

  // ---------- machines ----------

  private sync(): void {
    const s = game.state;
    this.syncMills();
    const seen = new Set<number>();
    for (const inst of s.machines) {
      seen.add(inst.id);
      const existing = this.views.get(inst.id);
      if (existing) {
        if (existing.at === placeKey(inst)) {
          existing.inst = inst;
          continue;
        }
        this.dropView(inst.id, existing); // it has been moved, or a new game reused this id
      }
      const def = MACHINES[inst.type];
      const plan = sitePlan(s, inst.site);
      const mv = plan.mill ? this.mills.get(plan.mill) : undefined;
      if (plan.mill && (!mv || plan.floor >= mv.floors.length)) continue; // its floor is not built
      const model = BUILDERS[inst.type]();
      optimizeModel(model, inst.type);
      const wx = plan.ox + inst.x + def.w / 2;
      const wz = plan.oz + inst.z + def.d / 2;
      model.group.position.set(wx, plan.oy, wz);
      // a machine turned about faces -z; its shafts still lie along the mill
      const turn = inst.flip ? -1 : 1;
      model.group.rotation.y = inst.flip ? Math.PI : 0;
      shadows(model.group);
      // only a machine's fixed body casts a shadow; its small moving parts need not
      model.group.traverse((o) => {
        if ((o as THREE.Mesh).isMesh && o.parent !== model.group) o.castShadow = false;
      });
      this.scene.add(model.group);
      const view: View = { inst, at: placeKey(inst), model, plan, t: inst.id * 1.37, speed: 0 };
      if (model.pulley && mv) {
        const px = wx + turn * model.pulley.x;
        view.drum = spokedWheel({ r: PT.drumR, rimT: 0.03, rimW: 0.14, spokes: 4, hubR: 0.07, hubLen: 0.14, spokeT: 0.03, m: M.iron, axis: 'x' });
        view.drum.position.x = px - plan.ox;
        view.drum.castShadow = true;
        mv.power.lineShafts[plan.floor].add(view.drum);
        view.belt = belt(
          { h: plan.oz + PT.zc, y: plan.oy + PT.yl, r: PT.drumR + 0.004 },
          { h: wz + turn * model.pulley.z, y: plan.oy + model.pulley.y, r: model.pulley.r + 0.004 },
          'x',
          px,
          0.08,
        );
        this.scene.add(view.belt);
      }
      model.animate(view.t, 0);
      this.views.set(inst.id, view);
      this.flowDirty = true;
    }
    for (const [id, v] of this.views) {
      if (seen.has(id)) continue;
      this.dropView(id, v);
      if (useUI.getState().selected === id) useUI.setState({ selected: null });
    }
  }

  private dropView(id: number, v: View): void {
    this.scene.remove(v.model.group);
    disposeTree(v.model.group);
    if (v.belt) {
      this.scene.remove(v.belt);
      v.belt.geometry.dispose();
    }
    if (v.drum) {
      v.drum.removeFromParent();
      disposeTree(v.drum);
    }
    this.views.delete(id);
    this.flowDirty = true;
  }

  // ---------- frame ----------

  frame(dt: number): void {
    const s = game.state;
    const ui = useUI.getState();
    const running = ui.speed > 0;
    this.frameNo++;
    this.sync();
    // a machine left selected on a storey no longer in view is let go (unless it is being carried to another floor)
    if (typeof ui.selected === 'number' && ui.moving !== ui.selected) {
      const sel = this.views.get(ui.selected);
      if (sel && !this.onShownStorey(sel.plan) && !ui.roofs) useUI.setState({ selected: null, isolate: false });
    }
    this.syncExhibit(ui.exhibit);
    if (this.exhibit) {
      this.exhibit.t += dt;
      this.exhibit.model.animate(this.exhibit.t, (this.exhibit.t / 20) % 1);
    }

    // keyboard pan
    const pan = 14 / this.zoom;
    const right = V(Math.cos(this.az), 0, -Math.sin(this.az));
    const fwd = V(-Math.sin(this.az), 0, -Math.cos(this.az));
    let moved = false;
    if (this.keys.has('a') || this.keys.has('arrowleft')) (this.target.addScaledVector(right, -pan * dt), (moved = true));
    if (this.keys.has('d') || this.keys.has('arrowright')) (this.target.addScaledVector(right, pan * dt), (moved = true));
    if (this.keys.has('w') || this.keys.has('arrowup')) (this.target.addScaledVector(fwd, pan * dt), (moved = true));
    if (this.keys.has('s') || this.keys.has('arrowdown')) (this.target.addScaledVector(fwd, -pan * dt), (moved = true));
    if (moved) this.targetGoal = null;

    const k = Math.min(1, dt * 7);
    this.az += (this.azGoal - this.az) * k;
    this.zoom += (this.zoomGoal - this.zoom) * k;
    if (this.targetGoal) {
      this.target.lerp(this.targetGoal, k);
      if (this.target.distanceTo(this.targetGoal) < 0.01) this.targetGoal = null;
    }
    if (!this.exhibit) {
      this.target.x = Math.max(-25, Math.min(60, this.target.x));
      this.target.z = Math.max(-40, Math.min(40, this.target.z));
    }
    this.placeCamera();

    const iso = ui.isolate && ui.selected !== null && !ui.roofs;
    // roofs settle on, or lift clear, over about a second
    this.roofLift += ((ui.roofs ? 0 : 1) - this.roofLift) * Math.min(1, dt * 4);
    const closed = ui.roofs; // walls all round
    const roofUp = this.roofLift * 7;
    const roofShown = this.roofLift < 0.97;
    this.cottageRoof.visible = roofShown;
    this.cottageRoof.position.y = 2.5 + roofUp;
    if (s.labour.housing !== this.housingRows) {
      if (this.housing) {
        this.scene.remove(this.housing);
        disposeTree(this.housing);
      }
      this.housing = buildHousing(s.labour.housing);
      shadows(this.housing);
      this.scene.add(this.housing);
      this.housingRows = s.labour.housing;
    }
    const isoEngine = iso ? this.engineOf(ui.selected) : null;
    const isoView = iso && typeof ui.selected === 'number' ? this.views.get(ui.selected) : undefined;
    // hide the walls nearest the camera, and any storeys above the level being viewed
    const d = this.camDir();
    for (const w of this.cottage.walls) w.obj.visible = !iso && (closed || w.n.dot(d) < 0);
    this.plot.visible = !s.mills.mill.built && s.tech.includes('waterMill');

    let beltTravel = 0;
    for (const mv of this.mills.values()) {
      // when one machine is being studied, lift off the storeys above it
      const top = isoView && isoView.plan.mill === mv.id ? isoView.plan.floor : ui.viewLevel;
      mv.floors.forEach((b, f) => {
        b.group.visible = (closed || f <= top) && !isoEngine;
        for (const w of b.walls) w.obj.visible = !iso && (closed || w.n.dot(d) < 0);
      });
      mv.power.floorGroups.forEach((g, f) => (g.visible = closed || f <= ui.viewLevel));
      mv.roof.visible = roofShown && !iso;
      mv.roof.position.y = mv.floors.length * FLOOR_H - 0.2 + roofUp;
      mv.power.group.visible = !iso || (ui.selected === 'power' && mv.id === 'mill');
      if (mv.engine) mv.engine.group.visible = !iso || isoEngine === mv;

      const p = s.power[mv.id];
      const goal = running ? p.factor : 0;
      mv.speed += (goal - mv.speed) * Math.min(1, dt * 2.5);
      const dAngle = dt * PT.wheelRps * TAU * mv.speed;
      mv.angle += dAngle;
      beltTravel = Math.max(beltTravel, dAngle);
      mv.power.animate(mv.angle, running ? p.flow : 0, dt);
      if (mv.engine) {
        const fired = s.stock.coal > 0;
        mv.engine.animate(mv.power.lineShafts[0].rotation.x, mv.speed, running ? dt : 0, fired && running, s.stock.coal);
        for (const w of mv.engine.workers) w.visible = fired;
      }
    }
    beltTexture.offset.x -= (beltTravel * LINE_RATIO * PT.drumR) / 0.6;
    this.ground.animate(running ? dt : 0);

    // machines
    for (const v of this.views.values()) {
      const goal = running ? v.inst.run : 0;
      v.speed += (goal - v.speed) * Math.min(1, dt * 3);
      v.t += dt * v.speed;
      const shown = iso ? ui.selected === v.inst.id : this.floorShown(v.plan);
      v.model.group.visible = shown;
      if (v.belt) v.belt.visible = !iso && shown;
      if (!shown) continue;
      const fill = MACHINES[v.inst.type].stage === 4 ? v.inst.total % 1 : 0;
      v.model.animate(v.t, fill);
      for (const w of v.model.workers) w.visible = v.inst.on;
    }

    // carts, barges and trains
    this.transport.update(s.transport, this.clock);

    // a fire: flames and smoke over the mill for a few seconds
    if (s.lastFire && s.lastFire.week !== this.seenFire) {
      this.seenFire = s.lastFire.week;
      // only a fire that has just broken out is shown, not one found in a loaded game's past
      this.flameUntil = s.week - s.lastFire.week < 2 ? this.frameNo + 420 : 0;
      const def = MILLS[s.lastFire.mill];
      this.flames.position.set(def.ox + millWidth(s, s.lastFire.mill) / 2, (s.lastFire.floor + 1) * FLOOR_H - 1, def.oz + def.d / 2);
    }
    this.flames.visible = this.frameNo < this.flameUntil;
    if (this.flames.visible) {
      this.flames.children.forEach((f, i) => {
        const u = (this.frameNo * 0.012 + i / 7) % 1;
        f.position.set(Math.sin(i * 2.4) * 5 + u * 2, u * (i % 2 ? 3 : 9), Math.cos(i * 1.7) * 2);
        f.scale.setScalar(i % 2 ? 1.2 - u : 0.8 + 2.5 * u);
      });
    }

    // sound follows what is at work near the middle of the view
    if (this.frameNo % 12 === 0 && sound.running) this.soundLevels(running);

    // goods in transit
    this.clock += running ? dt : 0;
    if (this.flowDirty || this.frameNo % 150 === 0) {
      this.flow.rebuild([...this.views.values()]);
      this.flowDirty = false;
    }
    // shown only for the machine selected: where its material comes from and its product goes
    const flowFor = typeof ui.selected === 'number' && !iso && !ui.roofs && !this.exhibit ? ui.selected : null;
    this.flow.update(this.clock, flowFor);

    if (this.frameNo % 30 === 1) {
      this.yard.update(s.stock.cotton, s.stock.weft + s.stock.warp + s.stock.roving + s.stock.fineYarn, s.stock.fustian + s.stock.calico + s.stock.muslin);
    }

    // placement ghost
    if (ui.placing && this.ghostAt) {
      const def = MACHINES[ui.placing];
      const plan = sitePlan(s, this.ghostAt.site);
      this.ghost.visible = true;
      this.ghost.scale.set(def.w, 1.2, def.d);
      this.ghost.position.set(plan.ox + this.ghostAt.x + def.w / 2, plan.oy + 0.62, plan.oz + this.ghostAt.z + def.d / 2);
      this.ghost.material = this.problemAt(this.ghostAt) ? this.ghostBad : this.ghostOk;
      const alleys = alleyRects(ui.placing, this.ghostAt.x, this.ghostAt.z, ui.flip);
      this.ghostAlleys.forEach((a, i) => {
        const r = alleys[i];
        a.visible = !!r;
        if (!r) return;
        a.scale.set(r.w, 0.06, r.d);
        a.position.set(plan.ox + r.x + r.w / 2, plan.oy + 0.06, plan.oz + r.z + r.d / 2);
      });
    } else {
      this.ghost.visible = false;
      for (const a of this.ghostAlleys) a.visible = false;
    }

    // selection outline
    const sb = this.exhibit ? null : this.boundsOf(ui.selected);
    this.selBox.visible = !!sb;
    if (sb) {
      sb.getCenter(this.selBox.position);
      sb.getSize(this.selBox.scale);
    }

    // Shadows are the costliest part of a frame: refresh them less often as the works grow.
    const every = this.views.size > 120 ? 6 : this.views.size > 50 ? 3 : 1;
    if (this.frameNo % every === 0) this.renderer.shadowMap.needsUpdate = true;
    this.renderer.render(this.scene, this.camera);
    this.updateLabels(ui.selected, ui.showLabels);
    this.updateStatusMarks(ui.overlay && !iso && !ui.roofs && !this.exhibit);
  }

  /** A small coloured mark over every machine that is not running freely, lettered by the cause. */
  private updateStatusMarks(show: boolean): void {
    const LETTER: Record<Limit, string> = { materials: 'M', hands: 'H', power: 'P', repair: 'R', strike: 'S', wages: '£', stopped: '–' };
    const w = this.container.clientWidth;
    const h = this.container.clientHeight;
    const p = V();
    let n = 0;
    if (show) {
      for (const v of this.views.values()) {
        const lim = limitOf(v.inst);
        // only machines on the storey you are looking down into: those beneath it are hidden by its floor
        if (!lim || !this.onShownStorey(v.plan) || n >= 250) continue;
        const def = MACHINES[v.inst.type];
        p.set(v.plan.ox + v.inst.x + def.w / 2, v.plan.oy + v.model.height + 0.3, v.plan.oz + v.inst.z + def.d / 2).project(this.camera);
        if (p.x < -1 || p.x > 1 || p.y < -1 || p.y > 1) continue;
        let el = this.statusEls[n];
        if (!el) {
          el = document.createElement('div');
          // a mark can be pointed at for the reason, and clicked to select its machine
          el.addEventListener('click', () => {
            const id = Number(el.dataset.id);
            if (id) useUI.setState({ selected: id, isolate: false });
          });
          this.labelLayer.appendChild(el);
          this.statusEls.push(el);
        }
        el.dataset.id = String(v.inst.id);
        el.title = `${MACHINES[v.inst.type].name}. ${limitReason(v.inst)}. Click to select.`;
        el.className = `status-mark ${lim}`;
        el.textContent = LETTER[lim];
        el.style.display = 'flex';
        el.style.transform = `translate(${((p.x + 1) / 2) * w}px, ${((1 - p.y) / 2) * h}px) translate(-50%, -50%)`;
        n++;
      }
    }
    for (let i = n; i < this.statusEls.length; i++) this.statusEls[i].style.display = 'none';
  }

  private soundLevels(running: boolean): void {
    const s = game.state;
    const near = (x: number, z: number, reach: number) => Math.exp(-Math.hypot(x - this.target.x, z - this.target.z) / reach);
    const zoomVol = Math.max(0.35, Math.min(1, this.zoom / 3));
    let looms = 0;
    let spindles = 0;
    for (const v of this.views.values()) {
      if (v.speed < 0.2) continue;
      const def = MACHINES[v.inst.type];
      const w = near(v.plan.ox + v.inst.x, v.plan.oz + v.inst.z, 12) * v.speed;
      if (def.stage === 4) looms += w * (def.power > 0 ? 1 : 0.5);
      else if (def.stage === 3) spindles += w;
    }
    let shaft = 0;
    let engine = 0;
    let water = 0;
    for (const mv of this.mills.values()) {
      const def = MILLS[mv.id];
      const w = near(def.ox + 10, def.oz + 3, 22) * mv.speed;
      shaft = Math.max(shaft, w);
      if (mv.engine && s.stock.coal > 0) engine = Math.max(engine, near(def.ox + millWidth(s, mv.id) + 3, def.oz + 2, 16) * mv.speed);
      if (def.wheel) water = Math.max(water, near(def.ox - 1.5, def.oz + 3.5, 14) * (0.3 + 0.7 * mv.speed));
    }
    const on = running && !this.exhibit ? zoomVol : 0;
    sound.set({ water: water * on + (running ? 0.08 : 0), shaft: shaft * on, looms: Math.min(1, looms / 5) * on, spindles: Math.min(1, spindles / 5) * on, engine: engine * on });
  }

  private updateLabels(sel: Selection, show: boolean): void {
    const labels = show ? this.labelsFor(sel) : [];
    while (this.labelEls.length < labels.length) {
      const el = document.createElement('div');
      el.className = 'part-marker';
      el.textContent = String(this.labelEls.length + 1);
      this.labelLayer.appendChild(el);
      this.labelEls.push(el);
    }
    // labels are given in the coordinates of the machine, or of the mill for its wheel and engine
    const root = this.exhibit ? this.exhibit.model.group : typeof sel === 'number' ? this.views.get(sel)?.model.group : sel === 'power' ? this.mills.get('mill')?.root : this.engineOf(sel)?.root;
    const w = this.container.clientWidth;
    const h = this.container.clientHeight;
    const p = V();
    for (let i = 0; i < this.labelEls.length; i++) {
      const el = this.labelEls[i];
      if (i >= labels.length || !root) {
        el.style.display = 'none';
        continue;
      }
      p.copy(labels[i].p);
      root.localToWorld(p);
      p.project(this.camera);
      el.style.display = 'flex';
      el.title = labels[i].name;
      el.style.transform = `translate(${((p.x + 1) / 2) * w}px, ${((1 - p.y) / 2) * h}px) translate(-50%, -50%)`;
    }
  }
}
