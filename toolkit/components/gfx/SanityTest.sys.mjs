/* This Source Code Form is subject to the terms of the Mozilla Public
 * License, v. 2.0. If a copy of the MPL was not distributed with this
 * file, You can obtain one at http://mozilla.org/MPL/2.0/. */

const FRAME_SCRIPT_URL = "chrome://gfxsanity/content/gfxFrameScript.js";

const TEST_DISABLED_PREF = "media.sanity-test.disabled";
const PAGE_WIDTH = 160;
const PAGE_HEIGHT = 234;
const LEFT_EDGE = 8;
const TOP_EDGE = 8;
const CANVAS_WIDTH = 32;
const CANVAS_HEIGHT = 64;
// If those values are ever changed, make sure to update
// WMFVideoMFTManager::CanUseDXVA accordingly.
const VIDEO_WIDTH = 132;
const VIDEO_HEIGHT = 132;
const DRIVER_PREF = "sanity-test.driver-version";
const DEVICE_PREF = "sanity-test.device-id";
const VERSION_PREF = "sanity-test.version";
const DISABLE_VIDEO_PREF = "media.hardware-video-decoding.failed";
const RUNNING_PREF = "sanity-test.running";
const TIMEOUT_SEC = 20;

const MEDIA_ENGINE_PREF = "media.wmf.media-engine.enabled";

// Glean.gfx.sanityTest values
const TEST_PASSED = 0;
const TEST_FAILED_RENDER = 1;
const TEST_FAILED_VIDEO = 2;
const TEST_CRASHED = 3;
const TEST_TIMEOUT = 4;

function testPixel(ctx, x, y, r, g, b, a, fuzz) {
  var data = ctx.getImageData(x, y, 1, 1);

  if (
    Math.abs(data.data[0] - r) <= fuzz &&
    Math.abs(data.data[1] - g) <= fuzz &&
    Math.abs(data.data[2] - b) <= fuzz &&
    Math.abs(data.data[3] - a) <= fuzz
  ) {
    return true;
  }
  return false;
}

function reportResult(val) {
  Glean.gfx.sanityTest.accumulateSingleSample(val);

  Services.prefs.setBoolPref(RUNNING_PREF, false);
  Services.prefs.savePrefFile(null);
}

function annotateCrashReport() {
  try {
    Services.appinfo.annotateCrashReport("TestKey", "1");
  } catch (e) {}
}

function removeCrashReportAnnotation() {
  try {
    Services.appinfo.removeCrashReportAnnotation("TestKey");
  } catch (e) {}
}

function setTimeout(aMs, aCallback) {
  var timer = Cc["@mozilla.org/timer;1"].createInstance(Ci.nsITimer);
  timer.initWithCallback(aCallback, aMs, Ci.nsITimer.TYPE_ONE_SHOT);
}

function takeWindowSnapshot(win, ctx) {
  // TODO: drawWindow reads back from the gpu's backbuffer, which won't catch issues with presenting
  // the front buffer via the window manager. Ideally we'd use an OS level API for reading back
  // from the desktop itself to get a more accurate test.
  var flags =
    ctx.DRAWWINDOW_DRAW_CARET |
    ctx.DRAWWINDOW_DRAW_VIEW |
    ctx.DRAWWINDOW_USE_WIDGET_LAYERS;
  ctx.drawWindow(
    win.ownerGlobal,
    0,
    0,
    PAGE_WIDTH,
    PAGE_HEIGHT,
    "rgb(255,255,255)",
    flags
  );
}

// Verify that all the 4 coloured squares of the video
// render as expected (with a tolerance of 64 to allow for
// yuv->rgb differences between platforms).
//
// The video is VIDEO_WIDTH*VIDEO_HEIGHT, and is split into quadrants of
// different colours. The top left of the video is LEFT_EDGE,TOP_EDGE+CANVAS_HEIGHT
// and we test a pixel into the middle of each quadrant to avoid
// blending differences at the edges.
//
// We allow massive amounts of fuzz for the colours since
// it can depend hugely on the yuv -> rgb conversion, and
// we don't want to fail unnecessarily.
function verifyVideoRendering(ctx) {
  return (
    testPixel(
      ctx,
      LEFT_EDGE + VIDEO_WIDTH / 4,
      TOP_EDGE + CANVAS_HEIGHT + VIDEO_HEIGHT / 4,
      255,
      255,
      255,
      255,
      64
    ) &&
    testPixel(
      ctx,
      LEFT_EDGE + (3 * VIDEO_WIDTH) / 4,
      TOP_EDGE + CANVAS_HEIGHT + VIDEO_HEIGHT / 4,
      0,
      255,
      0,
      255,
      64
    ) &&
    testPixel(
      ctx,
      LEFT_EDGE + VIDEO_WIDTH / 4,
      TOP_EDGE + CANVAS_HEIGHT + (3 * VIDEO_HEIGHT) / 4,
      0,
      0,
      255,
      255,
      64
    ) &&
    testPixel(
      ctx,
      LEFT_EDGE + (3 * VIDEO_WIDTH) / 4,
      TOP_EDGE + CANVAS_HEIGHT + (3 * VIDEO_HEIGHT) / 4,
      255,
      0,
      0,
      255,
      64
    )
  );
}

// Verify that the middle of the layers test is the color we expect.
// It's a red CANVAS_WIDTHxCANVAS_HEIGHT square, test a pixel deep into the
// square to prevent fuzzing, and another outside the expected limit of the
// square to check that scaling occurred properly. The square is drawn LEFT_EDGE
// pixels from the window's left edge and TOP_EDGE from the window's top edge.
function verifyLayersRendering(ctx) {
  return (
    testPixel(
      ctx,
      LEFT_EDGE + CANVAS_WIDTH / 2,
      TOP_EDGE + CANVAS_HEIGHT / 2,
      255,
      0,
      0,
      255,
      64
    ) &&
    testPixel(
      ctx,
      LEFT_EDGE + CANVAS_WIDTH,
      TOP_EDGE + CANVAS_HEIGHT / 2,
      255,
      255,
      255,
      255,
      64
    )
  );
}

function testCompositor(test, win, ctx) {
  takeWindowSnapshot(win, ctx);
  var testPassed = true;

  if (!verifyLayersRendering(ctx)) {
    reportResult(TEST_FAILED_RENDER);
    testPassed = false;
  } else if (!verifyVideoRendering(ctx)) {
    reportResult(TEST_FAILED_VIDEO);
    Services.prefs.setBoolPref(DISABLE_VIDEO_PREF, true);
    testPassed = false;
  }

  if (testPassed) {
    reportResult(TEST_PASSED);
  }

  return testPassed;
}

var listener = {
  win: null,
  utils: null,
  canvas: null,
  ctx: null,
  mm: null,
  mediaEnginePrefVal: 0,

  messages: ["gfxSanity:ContentLoaded"],

  scheduleTest(win) {
    this.win = win;
    this.win.onload = this.onWindowLoaded.bind(this);
    this.utils = this.win.windowUtils;
    setTimeout(TIMEOUT_SEC * 1000, () => {
      if (this.win) {
        reportResult(TEST_TIMEOUT);
        this.endTest();
      }
    });
  },

  runSanityTest() {
    this.canvas = this.win.document.createElementNS(
      "http://www.w3.org/1999/xhtml",
      "canvas"
    );
    this.canvas.setAttribute("width", PAGE_WIDTH);
    this.canvas.setAttribute("height", PAGE_HEIGHT);
    this.ctx = this.canvas.getContext("2d");

    // Perform the compositor backbuffer test, which currently we use for
    // actually deciding whether to enable hardware media decoding.
    testCompositor(this, this.win, this.ctx);

    this.endTest();
  },

  receiveMessage(message) {
    switch (message.name) {
      case "gfxSanity:ContentLoaded":
        this.runSanityTest();
        break;
    }
  },

  onWindowLoaded() {
    // Disable media engine pref if it's enabled because it doesn't support
    // capturing image to canvas.
    const prefVal = Services.prefs.getIntPref(MEDIA_ENGINE_PREF, 0);
    if (prefVal != 0) {
      Services.prefs.setIntPref(MEDIA_ENGINE_PREF, 0);
      this.mediaEnginePrefVal = prefVal;
    }

    let browser = this.win.document.createXULElement("browser");
    browser.setAttribute("type", "content");
    browser.setAttribute("disableglobalhistory", "true");

    let remoteBrowser = Services.appinfo.browserTabsRemoteAutostart;
    browser.setAttribute("remote", remoteBrowser);

    browser.style.width = PAGE_WIDTH + "px";
    browser.style.height = PAGE_HEIGHT + "px";

    this.win.document.documentElement.appendChild(browser);
    // Have to set the mm after we append the child
    this.mm = browser.messageManager;

    this.messages.forEach(msgName => {
      this.mm.addMessageListener(msgName, this);
    });

    this.mm.loadFrameScript(FRAME_SCRIPT_URL, false);
  },

  endTest() {
    if (!this.win) {
      return;
    }

    this.win.ownerGlobal.close();
    this.win = null;
    this.utils = null;
    this.canvas = null;
    this.ctx = null;

    if (this.mm) {
      // We don't have a MessageManager if onWindowLoaded never fired.
      this.messages.forEach(msgName => {
        this.mm.removeMessageListener(msgName, this);
      });

      this.mm = null;
    }

    if (this.mediaEnginePrefVal != 0) {
      Services.prefs.setIntPref(MEDIA_ENGINE_PREF, this.mediaEnginePrefVal);
      this.mediaEnginePrefVal = 0;
    }

    // Remove the annotation after we've cleaned everything up, to catch any
    // incidental crashes from having performed the sanity test.
    removeCrashReportAnnotation();
  },
};

export function SanityTest() {}
SanityTest.prototype = {
  classID: Components.ID("{f3a8ca4d-4c83-456b-aee2-6a2cbf11e9bd}"),
  QueryInterface: ChromeUtils.generateQI([
    "nsIObserver",
    "nsISupportsWeakReference",
  ]),

  shouldRunTest() {
    // Only test gfx features if firefox has updated, or if the user has a new
    // gpu or drivers.
    var buildId = Services.appinfo.platformBuildID;
    var gfxinfo = Cc["@mozilla.org/gfx/info;1"].getService(Ci.nsIGfxInfo);

    if (Services.prefs.getBoolPref(RUNNING_PREF, false)) {
      Services.prefs.setBoolPref(DISABLE_VIDEO_PREF, true);
      reportResult(TEST_CRASHED);
      return false;
    }

    function checkPref(pref, value) {
      let prefValue;
      let prefType = Services.prefs.getPrefType(pref);

      switch (prefType) {
        case Ci.nsIPrefBranch.PREF_INVALID:
          return false;

        case Ci.nsIPrefBranch.PREF_STRING:
          prefValue = Services.prefs.getStringPref(pref);
          break;

        case Ci.nsIPrefBranch.PREF_BOOL:
          prefValue = Services.prefs.getBoolPref(pref);
          break;

        case Ci.nsIPrefBranch.PREF_INT:
          prefValue = Services.prefs.getIntPref(pref);
          break;

        default:
          throw new Error("Unexpected preference type.");
      }

      return prefValue == value;
    }

    // TODO: Handle dual GPU setups
    if (
      checkPref(DRIVER_PREF, gfxinfo.adapterDriverVersion) &&
      checkPref(DEVICE_PREF, gfxinfo.adapterDeviceID) &&
      checkPref(VERSION_PREF, buildId)
    ) {
      return false;
    }

    // Enable hardware decoding so we can test again
    // and record the driver version to detect if the driver changes.
    Services.prefs.setBoolPref(DISABLE_VIDEO_PREF, false);
    Services.prefs.setStringPref(DRIVER_PREF, gfxinfo.adapterDriverVersion);
    Services.prefs.setStringPref(DEVICE_PREF, gfxinfo.adapterDeviceID);
    Services.prefs.setStringPref(VERSION_PREF, buildId);

    // Update the prefs so that this test doesn't run again until the next update.
    Services.prefs.setBoolPref(RUNNING_PREF, true);
    Services.prefs.savePrefFile(null);
    return true;
  },

  observe(subject, topic) {
    if (topic != "profile-after-change") {
      return;
    }
    if (Services.prefs.getBoolPref(TEST_DISABLED_PREF, false)) {
      return;
    }

    // profile-after-change fires only at startup, so we won't need
    // to use the listener again.
    let tester = listener;
    listener = null;

    if (!this.shouldRunTest()) {
      return;
    }

    annotateCrashReport();

    // Open a tiny window to render our test page, and notify us when it's loaded
    var sanityTest = Services.ww.openWindow(
      null,
      "chrome://gfxsanity/content/sanityparent.html",
      "Test Page",
      "width=" +
        PAGE_WIDTH +
        ",height=" +
        PAGE_HEIGHT +
        ",chrome,titlebar=0,scrollbars=0,dialog=1",
      null
    );

    let appWin = sanityTest.docShell.treeOwner
      .QueryInterface(Ci.nsIInterfaceRequestor)
      .getInterface(Ci.nsIAppWindow);

    // Request fast snapshot at RenderCompositor of WebRender.
    // Since readback of Windows DirectComposition is very slow.
    appWin.needFastSnaphot();

    // There's no clean way to have an invisible window and ensure it's always painted.
    // Instead, move the window far offscreen so it doesn't show up during launch.
    sanityTest.moveTo(100000000, 1000000000);
    // In multi-screens with different dpi setup, the window may have been
    // incorrectly resized.
    sanityTest.resizeTo(PAGE_WIDTH, PAGE_HEIGHT);
    tester.scheduleTest(sanityTest);
  },
};
