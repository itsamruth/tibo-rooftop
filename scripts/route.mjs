// Durations are real milliseconds. A held direction+space chord preserves
// horizontal momentum. Landing recharges X for the next aerial dash.
export async function playFloor(floor, { key, settle, check }, {
  fromCheckpoint = false,
  attempt = 1,
} = {}) {
  if (!Number.isInteger(floor) || floor < 1 || floor > 6) {
    throw new RangeError("Expected a floor number from 1 through 6");
  }

  const right = "Right";
  const left = "Left";
  const drop = (ms) => key("Down", ms);
  const other = (direction) => direction === right ? left : right;
  async function leap(direction, runMs, riseMs, dashMs, brakeMs = 0) {
    if (runMs) await key(direction, runMs);
    await key(direction + "+space", riseMs);
    await key(direction + "+x", dashMs);
    if (brakeMs) await key(other(direction), brakeMs);
  }

  // This stationary takeoff keeps the short basement jumps inside their
  // landing zones. Only the run-up and the end of the dash carry direction.
  async function basementStep(runMs, finishMs) {
    await key(right, runMs);
    await key("space", 160);
    await key("x", 45);
    await key(right, finishMs);
  }

  // Hazards keep moving after death. Vary the departure phase at a safe flag
  // on successive retries without changing the width of the tricky jumps.
  const phase = [0, 130, 340, 540][Math.abs(attempt - 1) % 4] ?? 0;
  if (phase && floor > 1) await drop(phase);

  switch (floor) {
    case 1: // Basement
      await basementStep(455, 280);
      await settle();
      await basementStep(62, 245);
      await settle();
      await basementStep(35, 190);
      // Reverse while still in the air. Stopping on this step lets it crumble.
      await leap(left, 310, 259, 163, 90);
      await drop(175);
      await check();
      await leap(left, 70, 216, 240);
      break;

    case 2: // Boiler Room
      // The flag respawns Tibo farther right than a leftward arrival.
      if (fromCheckpoint) await leap(left, 25, 223, 180, 80);
      else await leap(left, 0, 214, 161, 90);
      await settle();
      await leap(right, 45, 235, 181, 65);
      await drop(200);
      await check();
      await leap(right, 0, 230, 186, 78);
      await drop(195);
      await check();
      await leap(right, 36, 250, 242, 55);
      await drop(248);
      await leap(left, 0, 228, 185, 85);
      break;

    case 3: // Service Shaft
      // The respawn is at the middle of the flag ledge. The incoming jump
      // lands close to its left edge. Both routes target the same lift.
      if (fromCheckpoint) await leap(left, 164, 244, 177, 70);
      else await leap(left, 38, 253, 185, 70);
      await drop(250);
      await check();
      await leap(left, fromCheckpoint ? 34 : 65, 251, fromCheckpoint ? 193 : 205, 78);
      await drop(440); // Stay under the horizontal cannon shot.
      await check();
      await leap(right, 0, 247, 128, 110);
      await drop(215);
      await leap(right, 18, 244, 182, 75);
      await drop(222);
      await check();
      await leap(right, 0, 228, 177, 86);
      break;

    case 4: // Machine Hall
      await key("Down+Right", fromCheckpoint ? 1130 : 1086);
      await key("Right+space", fromCheckpoint ? 268 : 255);
      await key(left, 80);
      await drop(190);
      await check();
      await leap(left, 65, 251, 215, 83);
      await drop(230);
      // This low dash passes below the saw before the lift rises.
      await leap(left, 102, 188, 225, 85);
      await drop(195);
      await check();
      await leap(left, 60, 253, 217, 75);
      await drop(220);
      await check();
      await leap(right, 40, 240, 207, 65);
      break;

    case 5: // Antenna Deck
      await leap(right, fromCheckpoint ? 222 : 180, 248, 194, 83);
      await drop(205);
      await check();
      await leap(right, 12, 243, 175, 80);
      await drop(220);
      await check();
      await leap(left, 10, 213, 205, 73);
      await drop(220);
      await leap(left, 130, 244, 205, 81);
      await drop(200);
      await check();
      await leap(left, 24, 241, 197, 75);
      break;

    case 6: // Rooftop
      await leap(right, 95, 245, 204, 82);
      await drop(202);
      await leap(right, 95, 251, 236, 65);
      await drop(195);
      await check();
      await leap(right, 12, 245, 190, 75);
      break;
  }
  // The level counter and rooftop action appear when Tibo physically lands.
  // Never jump or dash here: Jump can activate a nearby rooftop reset.
  await drop(215);
  if (floor === 6) {
    // The moving lift changes the landing position. Tibo can be safely on the
    // final ledge but still a few steps to the left of the interaction radius.
    for (let step = 0; step < 4; step++) {
      await check();
      await key(right, 60);
    }
  }
}
