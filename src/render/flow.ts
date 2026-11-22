import * as THREE from 'three';
import type { SitePlan } from '../sim/actions';
import { GOODS, type Good } from '../sim/goods';
import { MACHINES } from '../sim/machines';
import type { MachineInst } from '../sim/state';

/**
 * Where a machine's material comes from and where its product goes.
 *
 * Nothing is drawn until a machine is selected. Then a line is drawn to each
 * machine that supplies it or takes its product (or to the doorway, for goods
 * bought in or sold), and a skip of the material travels along each line.
 */

const MAX = 64;
const SPEED = 1.3; // metres a second

const COLOUR: Partial<Record<Good, number>> = {
  cotton: 0xf7f4ec,
  lap: 0xf7f4ec,
  sliver: 0xf2ecdc,
  roving: 0xefe6cf,
  linenWarp: 0xb9a172,
  weft: 0xe0cf9f,
  warp: 0xd8c08a,
  dressed: 0xd8c08a,
  fineYarn: 0xe9dcb6,
  fustian: 0xa89674,
  calico: 0xcdbf9f,
  white: 0xffffff,
  print: 0xc46a5a,
  muslin: 0xe6ddc8,
};

export interface FlowSource {
  inst: MachineInst;
  plan: SitePlan;
  /** current speed of the machine's animation, 0..1 */
  speed: number;
}

interface Route {
  ax: number;
  az: number;
  bx: number;
  bz: number;
  y: number;
  len: number;
  phase: number;
  good: Good;
  /** the machines at each end; null for the doorway */
  from: FlowSource | null;
  to: FlowSource | null;
}

/** One line of the inspector's account of a machine's supplies. */
export interface FlowNote {
  good: string;
  /** 'in' for material arriving, 'out' for product leaving */
  dir: 'in' | 'out';
  other: string;
}

function centre(v: FlowSource): [number, number] {
  const def = MACHINES[v.inst.type];
  return [v.plan.ox + v.inst.x + def.w / 2, v.plan.oz + v.inst.z + def.d / 2];
}

/** Where goods enter and leave a floor: the doorway, or the hoist on an upper storey. */
function door(plan: SitePlan): [number, number] {
  return plan.mill ? [plan.ox + 1.6, plan.oz + plan.d - 0.6] : [plan.ox + plan.w - 0.5, plan.oz + plan.d / 2];
}

export class FlowLayer {
  /** add this to the scene */
  readonly group = new THREE.Group();
  private mesh: THREE.InstancedMesh;
  /** a bright strip along the floor for each route */
  private strips: THREE.InstancedMesh;
  private doorMark: THREE.Mesh;
  private routes: Route[] = [];
  private shownFor: number | null = null;
  private active: Route[] = [];
  private m = new THREE.Matrix4();

  constructor() {
    this.mesh = new THREE.InstancedMesh(new THREE.BoxGeometry(0.26, 0.2, 0.26), new THREE.MeshStandardMaterial({ roughness: 1 }), MAX);
    this.mesh.frustumCulled = false;
    this.mesh.count = 0;
    this.strips = new THREE.InstancedMesh(
      new THREE.BoxGeometry(1, 0.02, 0.14),
      new THREE.MeshBasicMaterial({ color: 0xffd54a, transparent: true, opacity: 0.85, depthTest: false }),
      MAX,
    );
    this.strips.frustumCulled = false;
    this.strips.count = 0;
    this.strips.renderOrder = 4;
    // a ring on the floor marking the doorway or hoist
    this.doorMark = new THREE.Mesh(new THREE.RingGeometry(0.35, 0.5, 24), new THREE.MeshBasicMaterial({ color: 0xffd54a, side: THREE.DoubleSide, depthTest: false }));
    this.doorMark.rotation.x = -Math.PI / 2;
    this.doorMark.renderOrder = 4;
    this.mesh.renderOrder = 5;
    this.group.add(this.strips, this.mesh, this.doorMark);
    this.group.visible = false;
  }

  /** Work out who supplies whom. Call when machines are added or removed, and now and then besides. */
  rebuild(views: FlowSource[]): void {
    const routes: Route[] = [];
    const bySite = new Map<string, FlowSource[]>();
    for (const v of views) {
      const list = bySite.get(v.inst.site) ?? [];
      list.push(v);
      bySite.set(v.inst.site, list);
    }
    const add = (a: [number, number], b: [number, number], y: number, good: Good, from: FlowSource | null, to: FlowSource | null) => {
      const len = Math.hypot(b[0] - a[0], b[1] - a[1]);
      if (len < 0.5) return;
      const id = (to ?? from)!.inst.id;
      routes.push({ ax: a[0], az: a[1], bx: b[0], bz: b[1], y, len, phase: (id * 0.618) % 1, good, from, to });
    };
    for (const list of bySite.values()) {
      for (const v of list) {
        const def = MACHINES[v.inst.type];
        const recipe = def.recipes.find((r) => r.label === v.inst.doing) ?? def.recipes[def.recipes.length - 1];
        const here = centre(v);
        for (const g of Object.keys(recipe.in) as Good[]) {
          // nearest machine on this floor that makes it; otherwise it comes in at the door
          let src: FlowSource | null = null;
          let best = Infinity;
          for (const o of list) {
            if (o === v || !MACHINES[o.inst.type].recipes.some((r) => g in r.out)) continue;
            const c = centre(o);
            const d = Math.hypot(c[0] - here[0], c[1] - here[1]);
            if (d < best) {
              best = d;
              src = o;
            }
          }
          add(src ? centre(src) : door(v.plan), here, v.plan.oy, g, src, v);
        }
        for (const g of Object.keys(recipe.out) as Good[]) {
          // finished goods nobody on this floor uses go out by the door
          const used = list.some((o) => o !== v && MACHINES[o.inst.type].recipes.some((r) => g in r.in));
          if (!used) add(here, door(v.plan), v.plan.oy, g, v, null);
        }
      }
    }
    this.routes = routes;
    this.shownFor = null; // force the selection to be worked out afresh
  }

  /** The routes touching one machine. */
  private routesOf(id: number): Route[] {
    return this.routes.filter((r) => r.from?.inst.id === id || r.to?.inst.id === id).slice(0, MAX);
  }

  /** In words, for the inspector: what the machine takes from where, and where its product goes. */
  describe(id: number): FlowNote[] {
    const name = (v: FlowSource | null, plan: SitePlan) => (v ? MACHINES[v.inst.type].name.toLowerCase() : plan.mill && plan.floor > 0 ? 'the hoist' : 'the door');
    const notes: FlowNote[] = [];
    for (const r of this.routesOf(id)) {
      const mine = r.to?.inst.id === id ? r.to! : r.from!;
      const incoming = r.to?.inst.id === id;
      notes.push({ good: GOODS[r.good].name, dir: incoming ? 'in' : 'out', other: name(incoming ? r.from : r.to, mine.plan) });
    }
    // several machines of a kind taking the same product read better as one line
    const seen = new Set<string>();
    return notes.filter((n) => {
      const k = n.dir + n.good + n.other;
      if (seen.has(k)) return false;
      seen.add(k);
      return true;
    });
  }

  /** selected: the machine whose supplies are to be shown, or null to show nothing. */
  update(time: number, selected: number | null): void {
    if (selected !== this.shownFor) {
      this.shownFor = selected;
      this.active = selected === null ? [] : this.routesOf(selected);
      this.mesh.count = this.active.length;
      let usesDoor: Route | null = null;
      this.active.forEach((r, i) => {
        this.mesh.setColorAt(i, new THREE.Color(COLOUR[r.good] ?? 0xffffff));
        // a strip from end to end, lying on the floor
        this.m.makeRotationY(-Math.atan2(r.bz - r.az, r.bx - r.ax));
        this.m.scale(new THREE.Vector3(r.len, 1, 1));
        this.m.setPosition((r.ax + r.bx) / 2, r.y + 0.08, (r.az + r.bz) / 2);
        this.strips.setMatrixAt(i, this.m);
        if (!r.from || !r.to) usesDoor = r;
      });
      if (this.mesh.instanceColor) this.mesh.instanceColor.needsUpdate = true;
      this.strips.count = this.active.length;
      this.strips.instanceMatrix.needsUpdate = true;
      const d = usesDoor as Route | null;
      this.doorMark.visible = !!d;
      if (d) this.doorMark.position.set(d.from ? d.bx : d.ax, d.y + 0.06, d.from ? d.bz : d.az);
    }
    this.group.visible = this.active.length > 0;
    for (let i = 0; i < this.active.length; i++) {
      const r = this.active[i];
      const u = ((time * SPEED) / r.len + r.phase) % 1;
      this.m.makeTranslation(r.ax + (r.bx - r.ax) * u, r.y + 0.22, r.az + (r.bz - r.az) * u);
      this.mesh.setMatrixAt(i, this.m);
    }
    this.mesh.instanceMatrix.needsUpdate = true;
  }
}
