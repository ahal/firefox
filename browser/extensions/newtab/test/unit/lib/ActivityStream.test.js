import { CONTENT_MESSAGE_TYPE } from "common/Actions.mjs";
import {
  ActivityStream,
  PREFS_CONFIG,
  csvPrefHasValue,
} from "lib/ActivityStream.sys.mjs";
import { GlobalOverrider } from "test/unit/utils";

import { DEFAULT_SITES } from "lib/DefaultSites.sys.mjs";
import { AboutPreferences } from "lib/AboutPreferences.sys.mjs";
import { DefaultPrefs } from "lib/ActivityStreamPrefs.sys.mjs";
import { NewTabInit } from "lib/NewTabInit.sys.mjs";
import { SectionsFeed } from "lib/SectionsManager.sys.mjs";
import { RecommendationProvider } from "lib/RecommendationProvider.sys.mjs";
import { PlacesFeed } from "lib/PlacesFeed.sys.mjs";
import { PrefsFeed } from "lib/PrefsFeed.sys.mjs";
import { SystemTickFeed } from "lib/SystemTickFeed.sys.mjs";
import { TelemetryFeed } from "lib/TelemetryFeed.sys.mjs";
import { FaviconFeed } from "lib/FaviconFeed.sys.mjs";
import { TopSitesFeed } from "lib/TopSitesFeed.sys.mjs";
import { TopStoriesFeed } from "lib/TopStoriesFeed.sys.mjs";
import { HighlightsFeed } from "lib/HighlightsFeed.sys.mjs";
import { DiscoveryStreamFeed } from "lib/DiscoveryStreamFeed.sys.mjs";

import { PersistentCache } from "lib/PersistentCache.sys.mjs";
import { DownloadsManager } from "lib/DownloadsManager.sys.mjs";

describe("ActivityStream", () => {
  let sandbox;
  let as;
  function FakeStore() {
    return { init: () => {}, uninit: () => {}, feeds: { get: () => {} } };
  }

  let globals;
  beforeEach(() => {
    globals = new GlobalOverrider();
    globals.set({
      Store: FakeStore,

      DEFAULT_SITES,
      AboutPreferences,
      DefaultPrefs,
      NewTabInit,
      SectionsFeed,
      RecommendationProvider,
      PlacesFeed,
      PrefsFeed,
      SystemTickFeed,
      TelemetryFeed,
      FaviconFeed,
      TopSitesFeed,
      TopStoriesFeed,
      HighlightsFeed,
      DiscoveryStreamFeed,

      PersistentCache,
      DownloadsManager,
    });

    as = new ActivityStream();
    sandbox = sinon.createSandbox();
    sandbox.stub(as.store, "init");
    sandbox.stub(as.store, "uninit");
    sandbox.stub(as._defaultPrefs, "init");
    PREFS_CONFIG.get("feeds.system.topstories").value = undefined;
  });

  afterEach(() => {
    sandbox.restore();
    globals.restore();
  });

  it("should exist", () => {
    assert.ok(ActivityStream);
  });
  it("should initialize with .initialized=false", () => {
    assert.isFalse(as.initialized, ".initialized");
  });
  describe("#init", () => {
    beforeEach(() => {
      as.init();
    });
    it("should initialize default prefs", () => {
      assert.calledOnce(as._defaultPrefs.init);
    });
    it("should set .initialized to true", () => {
      assert.isTrue(as.initialized, ".initialized");
    });
    it("should call .store.init", () => {
      assert.calledOnce(as.store.init);
    });
    it("should pass to Store an INIT event for content", () => {
      as.init();

      const [, action] = as.store.init.firstCall.args;
      assert.equal(action.meta.to, CONTENT_MESSAGE_TYPE);
    });
    it("should pass to Store an UNINIT event", () => {
      as.init();

      const [, , action] = as.store.init.firstCall.args;
      assert.equal(action.type, "UNINIT");
    });
    it("should clear old default discoverystream config pref", () => {
      sandbox.stub(global.Services.prefs, "prefHasUserValue").returns(true);
      sandbox
        .stub(global.Services.prefs, "getStringPref")
        .returns(
          `{"api_key_pref":"extensions.pocket.oAuthConsumerKey","enabled":false,"show_spocs":true,"layout_endpoint":"https://getpocket.cdn.mozilla.net/v3/newtab/layout?version=1&consumer_key=$apiKey&layout_variant=basic"}`
        );
      sandbox.stub(global.Services.prefs, "clearUserPref");

      as.init();

      assert.calledWith(
        global.Services.prefs.clearUserPref,
        "browser.newtabpage.activity-stream.discoverystream.config"
      );
    });
    it("should call addObserver for the app locales", () => {
      sandbox.stub(global.Services.obs, "addObserver");
      as.init();
      assert.calledWith(
        global.Services.obs.addObserver,
        as,
        "intl:app-locales-changed"
      );
    });
  });
  describe("#uninit", () => {
    beforeEach(() => {
      as.init();
      as.uninit();
    });
    it("should set .initialized to false", () => {
      assert.isFalse(as.initialized, ".initialized");
    });
    it("should call .store.uninit", () => {
      assert.calledOnce(as.store.uninit);
    });
    it("should call removeObserver for the region", () => {
      sandbox.stub(global.Services.obs, "removeObserver");
      as.geo = "";
      as.uninit();
      assert.calledWith(
        global.Services.obs.removeObserver,
        as,
        global.Region.REGION_TOPIC
      );
    });
    it("should call removeObserver for the app locales", () => {
      sandbox.stub(global.Services.obs, "removeObserver");
      as.uninit();
      assert.calledWith(
        global.Services.obs.removeObserver,
        as,
        "intl:app-locales-changed"
      );
    });
  });
  describe("#observe", () => {
    it("should call _updateDynamicPrefs from observe", () => {
      sandbox.stub(as, "_updateDynamicPrefs");
      as.observe(undefined, global.Region.REGION_TOPIC);
      assert.calledOnce(as._updateDynamicPrefs);
    });
  });
  describe("feeds", () => {
    it("should create a NewTabInit feed", () => {
      const feed = as.feeds.get("feeds.newtabinit")();
      assert.ok(feed, "feed should exist");
    });
    it("should create a Places feed", () => {
      const feed = as.feeds.get("feeds.places")();
      assert.ok(feed, "feed should exist");
    });
    it("should create a TopSites feed", () => {
      const feed = as.feeds.get("feeds.system.topsites")();
      assert.ok(feed, "feed should exist");
    });
    it("should create a Telemetry feed", () => {
      const feed = as.feeds.get("feeds.telemetry")();
      assert.ok(feed, "feed should exist");
    });
    it("should create a Prefs feed", () => {
      const feed = as.feeds.get("feeds.prefs")();
      assert.ok(feed, "feed should exist");
    });
    it("should create a HighlightsFeed feed", () => {
      const feed = as.feeds.get("feeds.section.highlights")();
      assert.ok(feed, "feed should exist");
    });
    it("should create a TopStoriesFeed feed", () => {
      const feed = as.feeds.get("feeds.system.topstories")();
      assert.ok(feed, "feed should exist");
    });
    it("should create a AboutPreferences feed", () => {
      const feed = as.feeds.get("feeds.aboutpreferences")();
      assert.ok(feed, "feed should exist");
    });
    it("should create a SectionsFeed", () => {
      const feed = as.feeds.get("feeds.sections")();
      assert.ok(feed, "feed should exist");
    });
    it("should create a SystemTick feed", () => {
      const feed = as.feeds.get("feeds.systemtick")();
      assert.ok(feed, "feed should exist");
    });
    it("should create a Favicon feed", () => {
      const feed = as.feeds.get("feeds.favicon")();
      assert.ok(feed, "feed should exist");
    });
    it("should create a RecommendationProvider feed", () => {
      const feed = as.feeds.get("feeds.recommendationprovider")();
      assert.ok(feed, "feed should exist");
    });
    it("should create a DiscoveryStreamFeed feed", () => {
      const feed = as.feeds.get("feeds.discoverystreamfeed")();
      assert.ok(feed, "feed should exist");
    });
  });
  describe("_migratePref", () => {
    it("should migrate a pref if the user has set a custom value", () => {
      sandbox.stub(global.Services.prefs, "prefHasUserValue").returns(true);
      sandbox.stub(global.Services.prefs, "getPrefType").returns("integer");
      sandbox.stub(global.Services.prefs, "getIntPref").returns(10);
      as._migratePref("oldPrefName", result => assert.equal(10, result));
    });
    it("should not migrate a pref if the user has not set a custom value", () => {
      // we bailed out early so we don't check the pref type later
      sandbox.stub(global.Services.prefs, "prefHasUserValue").returns(false);
      sandbox.stub(global.Services.prefs, "getPrefType");
      as._migratePref("oldPrefName");
      assert.notCalled(global.Services.prefs.getPrefType);
    });
    it("should use the proper pref getter for each type", () => {
      sandbox.stub(global.Services.prefs, "prefHasUserValue").returns(true);

      // Integer
      sandbox.stub(global.Services.prefs, "getIntPref");
      sandbox.stub(global.Services.prefs, "getPrefType").returns("integer");
      as._migratePref("oldPrefName", () => {});
      assert.calledWith(global.Services.prefs.getIntPref, "oldPrefName");

      // Boolean
      sandbox.stub(global.Services.prefs, "getBoolPref");
      global.Services.prefs.getPrefType.returns("boolean");
      as._migratePref("oldPrefName", () => {});
      assert.calledWith(global.Services.prefs.getBoolPref, "oldPrefName");

      // String
      sandbox.stub(global.Services.prefs, "getStringPref");
      global.Services.prefs.getPrefType.returns("string");
      as._migratePref("oldPrefName", () => {});
      assert.calledWith(global.Services.prefs.getStringPref, "oldPrefName");
    });
    it("should clear the old pref after setting the new one", () => {
      sandbox.stub(global.Services.prefs, "prefHasUserValue").returns(true);
      sandbox.stub(global.Services.prefs, "clearUserPref");
      sandbox.stub(global.Services.prefs, "getPrefType").returns("integer");
      as._migratePref("oldPrefName", () => {});
      assert.calledWith(global.Services.prefs.clearUserPref, "oldPrefName");
    });
  });
  describe("csvPrefHasValue", () => {
    let getStringPrefStub;
    beforeEach(() => {
      getStringPrefStub = sandbox.stub(global.Services.prefs, "getStringPref");
      sandbox.stub(global.Region, "home").get(() => "CA");
      sandbox
        .stub(global.Services.locale, "appLocaleAsBCP47")
        .get(() => "en-CA");
    });
    it("throws an error when the pref argument is not a string", () => {
      assert.throws(
        () => csvPrefHasValue(0, "foo"),
        Error,
        "The stringPrefName argument is not a string"
      );
    });
    it("returns true if pref contains test value", () => {
      getStringPrefStub.withArgs("example.csvPref").returns("foo,bar");
      const featureCheck = csvPrefHasValue("example.csvPref", "foo");
      assert.isTrue(featureCheck);
    });
    it("returns false if pref contains test value", () => {
      getStringPrefStub.withArgs("example.csvPref").returns("foo,bar");
      const featureCheck = csvPrefHasValue("example.csvPref", "baz");
      assert.isFalse(featureCheck);
    });
    it("returns false if pref value returns empty", () => {
      getStringPrefStub.withArgs("example.csvPref").returns("");
      const featureCheck = csvPrefHasValue("example.csvPref", "foo");
      assert.isFalse(featureCheck);
    });
    it("returns false if test value is blank", () => {
      getStringPrefStub.withArgs("example.csvPref").returns("foo,bar");
      const featureCheck = csvPrefHasValue("example.csvPref", "");
      assert.isFalse(featureCheck);
    });
  });
  describe("showWeather", () => {
    let stub;
    let getStringPrefStub;
    const FEATURE_ENABLED_PREF = "system.showWeather";
    const REGION_WEATHER_CONFIG =
      "browser.newtabpage.activity-stream.discoverystream.region-weather-config";
    const LOCALE_WEATHER_CONFIG =
      "browser.newtabpage.activity-stream.discoverystream.locale-weather-config";
    beforeEach(() => {
      stub = sandbox.stub(global.Region, "home");

      sandbox
        .stub(global.Services.locale, "appLocaleAsBCP47")
        .get(() => "en-US");

      getStringPrefStub = sandbox.stub(global.Services.prefs, "getStringPref");

      // Set default regions
      getStringPrefStub.withArgs(REGION_WEATHER_CONFIG).returns("US, CA");

      // Set default locales
      getStringPrefStub
        .withArgs(LOCALE_WEATHER_CONFIG)
        .returns("en-US,en-GB,en-CA");
    });
    it("should turn off when region and locale are not set", () => {
      stub.get(() => "");
      sandbox.stub(global.Services.locale, "appLocaleAsBCP47").get(() => "");
      as._updateDynamicPrefs();
      assert.isFalse(PREFS_CONFIG.get(FEATURE_ENABLED_PREF).value);
    });
    it("should turn off when region is not set", () => {
      stub.get(() => "");
      as._updateDynamicPrefs();
      assert.isFalse(PREFS_CONFIG.get(FEATURE_ENABLED_PREF).value);
    });
    it("should turn on when region is supported", () => {
      stub.get(() => "US");
      as._updateDynamicPrefs();
      assert.isTrue(PREFS_CONFIG.get(FEATURE_ENABLED_PREF).value);
    });
    it("should turn off when region is not supported", () => {
      stub.get(() => "FR");
      as._updateDynamicPrefs();
      assert.isFalse(PREFS_CONFIG.get(FEATURE_ENABLED_PREF).value);
    });
    it("should turn off when locale is not set", () => {
      stub.get(() => "US");
      sandbox.stub(global.Services.locale, "appLocaleAsBCP47").get(() => "");
      as._updateDynamicPrefs();
      assert.isFalse(PREFS_CONFIG.get(FEATURE_ENABLED_PREF).value);
    });
    it("should turn on when locale is supported", () => {
      stub.get(() => "US");
      sandbox
        .stub(global.Services.locale, "appLocaleAsBCP47")
        .get(() => "en-US");
      as._updateDynamicPrefs();
      assert.isTrue(PREFS_CONFIG.get(FEATURE_ENABLED_PREF).value);
    });
    it("should turn off when locale is not supported", () => {
      stub.get(() => "US");
      sandbox.stub(global.Services.locale, "appLocaleAsBCP47").get(() => "fr");
      as._updateDynamicPrefs();
      assert.isFalse(PREFS_CONFIG.get(FEATURE_ENABLED_PREF).value);
    });
    it("should turn off when region and locale are both not supported", () => {
      stub.get(() => "FR");
      sandbox.stub(global.Services.locale, "appLocaleAsBCP47").get(() => "fr");
      as._updateDynamicPrefs();
      assert.isFalse(PREFS_CONFIG.get(FEATURE_ENABLED_PREF).value);
    });
  });
  describe("showTopicsSelection", () => {
    let stub;
    let getStringPrefStub;
    const FEATURE_ENABLED_PREF = "discoverystream.topicSelection.enabled";
    const REGION_TOPICS_CONFIG =
      "browser.newtabpage.activity-stream.discoverystream.topicSelection.region-topics-config";
    const LOCALE_TOPICS_CONFIG =
      "browser.newtabpage.activity-stream.discoverystream.topicSelection.locale-topics-config";
    beforeEach(() => {
      stub = sandbox.stub(global.Region, "home");

      sandbox
        .stub(global.Services.locale, "appLocaleAsBCP47")
        .get(() => "en-US");

      getStringPrefStub = sandbox.stub(global.Services.prefs, "getStringPref");

      // Set default regions
      getStringPrefStub.withArgs(REGION_TOPICS_CONFIG).returns("US, CA");

      // Set default locales
      getStringPrefStub
        .withArgs(LOCALE_TOPICS_CONFIG)
        .returns("en-US,en-GB,en-CA");
    });
    it("should turn off when region and locale are not set", () => {
      stub.get(() => "");
      sandbox.stub(global.Services.locale, "appLocaleAsBCP47").get(() => "");
      as._updateDynamicPrefs();
      assert.isFalse(PREFS_CONFIG.get(FEATURE_ENABLED_PREF).value);
    });
    it("should turn off when region is not set", () => {
      stub.get(() => "");
      as._updateDynamicPrefs();
      assert.isFalse(PREFS_CONFIG.get(FEATURE_ENABLED_PREF).value);
    });
    it("should turn on when region is supported", () => {
      stub.get(() => "US");
      as._updateDynamicPrefs();
      assert.isTrue(PREFS_CONFIG.get(FEATURE_ENABLED_PREF).value);
    });
    it("should turn off when region is not supported", () => {
      stub.get(() => "FR");
      as._updateDynamicPrefs();
      assert.isFalse(PREFS_CONFIG.get(FEATURE_ENABLED_PREF).value);
    });
    it("should turn off when locale is not set", () => {
      stub.get(() => "US");
      sandbox.stub(global.Services.locale, "appLocaleAsBCP47").get(() => "");
      as._updateDynamicPrefs();
      assert.isFalse(PREFS_CONFIG.get(FEATURE_ENABLED_PREF).value);
    });
    it("should turn on when locale is supported", () => {
      stub.get(() => "US");
      sandbox
        .stub(global.Services.locale, "appLocaleAsBCP47")
        .get(() => "en-US");
      as._updateDynamicPrefs();
      assert.isTrue(PREFS_CONFIG.get(FEATURE_ENABLED_PREF).value);
    });
    it("should turn off when locale is not supported", () => {
      stub.get(() => "US");
      sandbox.stub(global.Services.locale, "appLocaleAsBCP47").get(() => "fr");
      as._updateDynamicPrefs();
      assert.isFalse(PREFS_CONFIG.get(FEATURE_ENABLED_PREF).value);
    });
    it("should turn off when region and locale are both not supported", () => {
      stub.get(() => "FR");
      sandbox.stub(global.Services.locale, "appLocaleAsBCP47").get(() => "fr");
      as._updateDynamicPrefs();
      assert.isFalse(PREFS_CONFIG.get(FEATURE_ENABLED_PREF).value);
    });
  });
  describe("showTopicLabels", () => {
    let stub;
    let getStringPrefStub;
    const FEATURE_ENABLED_PREF = "discoverystream.topicLabels.enabled";
    const REGION_TOPIC_LABEL_CONFIG =
      "browser.newtabpage.activity-stream.discoverystream.topicLabels.region-topic-label-config";
    const LOCALE_TOPIC_LABEL_CONFIG =
      "browser.newtabpage.activity-stream.discoverystream.topicLabels.locale-topic-label-config";
    beforeEach(() => {
      stub = sandbox.stub(global.Region, "home");

      sandbox
        .stub(global.Services.locale, "appLocaleAsBCP47")
        .get(() => "en-US");

      getStringPrefStub = sandbox.stub(global.Services.prefs, "getStringPref");

      // Set default regions
      getStringPrefStub.withArgs(REGION_TOPIC_LABEL_CONFIG).returns("US, CA");

      // Set default locales
      getStringPrefStub
        .withArgs(LOCALE_TOPIC_LABEL_CONFIG)
        .returns("en-US,en-GB,en-CA");
    });
    it("should turn off when region and locale are not set", () => {
      stub.get(() => "");
      sandbox.stub(global.Services.locale, "appLocaleAsBCP47").get(() => "");
      as._updateDynamicPrefs();
      assert.isFalse(PREFS_CONFIG.get(FEATURE_ENABLED_PREF).value);
    });
    it("should turn off when region is not set", () => {
      stub.get(() => "");
      as._updateDynamicPrefs();
      assert.isFalse(PREFS_CONFIG.get(FEATURE_ENABLED_PREF).value);
    });
    it("should turn on when region is supported", () => {
      stub.get(() => "US");
      as._updateDynamicPrefs();
      assert.isTrue(PREFS_CONFIG.get(FEATURE_ENABLED_PREF).value);
    });
    it("should turn off when region is not supported", () => {
      stub.get(() => "FR");
      as._updateDynamicPrefs();
      assert.isFalse(PREFS_CONFIG.get(FEATURE_ENABLED_PREF).value);
    });
    it("should turn off when locale is not set", () => {
      stub.get(() => "US");
      sandbox.stub(global.Services.locale, "appLocaleAsBCP47").get(() => "");
      as._updateDynamicPrefs();
      assert.isFalse(PREFS_CONFIG.get(FEATURE_ENABLED_PREF).value);
    });
    it("should turn on when locale is supported", () => {
      stub.get(() => "US");
      sandbox
        .stub(global.Services.locale, "appLocaleAsBCP47")
        .get(() => "en-US");
      as._updateDynamicPrefs();
      assert.isTrue(PREFS_CONFIG.get(FEATURE_ENABLED_PREF).value);
    });
    it("should turn off when locale is not supported", () => {
      stub.get(() => "US");
      sandbox.stub(global.Services.locale, "appLocaleAsBCP47").get(() => "fr");
      as._updateDynamicPrefs();
      assert.isFalse(PREFS_CONFIG.get(FEATURE_ENABLED_PREF).value);
    });
    it("should turn off when region and locale are both not supported", () => {
      stub.get(() => "FR");
      sandbox.stub(global.Services.locale, "appLocaleAsBCP47").get(() => "fr");
      as._updateDynamicPrefs();
      assert.isFalse(PREFS_CONFIG.get(FEATURE_ENABLED_PREF).value);
    });
  });
  describe("showThumbsUpDown", () => {
    let stub;
    let getStringPrefStub;
    const FEATURE_ENABLED_PREF = "discoverystream.thumbsUpDown.enabled";
    const REGION_THUMBS_CONFIG =
      "browser.newtabpage.activity-stream.discoverystream.thumbsUpDown.region-thumbs-config";
    const LOCALE_THUMBS_CONFIG =
      "browser.newtabpage.activity-stream.discoverystream.thumbsUpDown.locale-thumbs-config";

    beforeEach(() => {
      stub = sandbox.stub(global.Region, "home");

      sandbox
        .stub(global.Services.locale, "appLocaleAsBCP47")
        .get(() => "en-US");

      getStringPrefStub = sandbox.stub(global.Services.prefs, "getStringPref");

      // Set default regions
      getStringPrefStub.withArgs(REGION_THUMBS_CONFIG).returns("US, CA");

      // Set default locales
      getStringPrefStub
        .withArgs(LOCALE_THUMBS_CONFIG)
        .returns("en-US,en-GB,en-CA");
    });
    it("should turn off when region and locale are not set", () => {
      stub.get(() => "");
      sandbox.stub(global.Services.locale, "appLocaleAsBCP47").get(() => "");
      as._updateDynamicPrefs();
      assert.isFalse(PREFS_CONFIG.get(FEATURE_ENABLED_PREF).value);
    });
    it("should turn off when region is not set", () => {
      stub.get(() => "");
      as._updateDynamicPrefs();
      assert.isFalse(PREFS_CONFIG.get(FEATURE_ENABLED_PREF).value);
    });
    it("should turn on when region is supported", () => {
      stub.get(() => "US");
      as._updateDynamicPrefs();
      assert.isTrue(PREFS_CONFIG.get(FEATURE_ENABLED_PREF).value);
    });
    it("should turn off when region is not supported", () => {
      stub.get(() => "FR");
      as._updateDynamicPrefs();
      assert.isFalse(PREFS_CONFIG.get(FEATURE_ENABLED_PREF).value);
    });
    it("should turn off when locale is not set", () => {
      stub.get(() => "US");
      sandbox.stub(global.Services.locale, "appLocaleAsBCP47").get(() => "");
      as._updateDynamicPrefs();
      assert.isFalse(PREFS_CONFIG.get(FEATURE_ENABLED_PREF).value);
    });
    it("should turn on when locale is supported", () => {
      stub.get(() => "US");
      sandbox
        .stub(global.Services.locale, "appLocaleAsBCP47")
        .get(() => "en-US");
      as._updateDynamicPrefs();
      assert.isTrue(PREFS_CONFIG.get(FEATURE_ENABLED_PREF).value);
    });
    it("should turn off when locale is not supported", () => {
      stub.get(() => "US");
      sandbox.stub(global.Services.locale, "appLocaleAsBCP47").get(() => "fr");
      as._updateDynamicPrefs();
      assert.isFalse(PREFS_CONFIG.get(FEATURE_ENABLED_PREF).value);
    });
    it("should turn off when region and locale are both not supported", () => {
      stub.get(() => "FR");
      sandbox.stub(global.Services.locale, "appLocaleAsBCP47").get(() => "fr");
      as._updateDynamicPrefs();
      assert.isFalse(PREFS_CONFIG.get(FEATURE_ENABLED_PREF).value);
    });
  });
  describe("showContextualContent", () => {
    let stub;
    let getStringPrefStub;
    const FEATURE_ENABLED_PREF = "discoverystream.contextualContent.enabled";
    const REGION_CONTEXTUAL_CONTENT_CONFIG =
      "browser.newtabpage.activity-stream.discoverystream.contextualContent.region-content-config";
    const LOCALE_CONTEXTUAL_CONTENT_CONFIG =
      "browser.newtabpage.activity-stream.discoverystream.contextualContent.locale-content-config";

    beforeEach(() => {
      stub = sandbox.stub(global.Region, "home");

      sandbox
        .stub(global.Services.locale, "appLocaleAsBCP47")
        .get(() => "en-US");

      getStringPrefStub = sandbox.stub(global.Services.prefs, "getStringPref");

      // Set default regions
      getStringPrefStub
        .withArgs(REGION_CONTEXTUAL_CONTENT_CONFIG)
        .returns("US, CA");

      // Set default locales
      getStringPrefStub
        .withArgs(LOCALE_CONTEXTUAL_CONTENT_CONFIG)
        .returns("en-US,en-GB,en-CA");
    });
    it("should turn off when region and locale are not set", () => {
      stub.get(() => "");
      sandbox.stub(global.Services.locale, "appLocaleAsBCP47").get(() => "");
      as._updateDynamicPrefs();
      assert.isFalse(PREFS_CONFIG.get(FEATURE_ENABLED_PREF).value);
    });
    it("should turn off when region is not set", () => {
      stub.get(() => "");
      as._updateDynamicPrefs();
      assert.isFalse(PREFS_CONFIG.get(FEATURE_ENABLED_PREF).value);
    });
    it("should turn on when region is supported", () => {
      stub.get(() => "US");
      as._updateDynamicPrefs();
      assert.isTrue(PREFS_CONFIG.get(FEATURE_ENABLED_PREF).value);
    });
    it("should turn off when region is not supported", () => {
      stub.get(() => "FR");
      as._updateDynamicPrefs();
      assert.isFalse(PREFS_CONFIG.get(FEATURE_ENABLED_PREF).value);
    });
    it("should turn off when locale is not set", () => {
      stub.get(() => "US");
      sandbox.stub(global.Services.locale, "appLocaleAsBCP47").get(() => "");
      as._updateDynamicPrefs();
      assert.isFalse(PREFS_CONFIG.get(FEATURE_ENABLED_PREF).value);
    });
    it("should turn on when locale is supported", () => {
      stub.get(() => "US");
      sandbox
        .stub(global.Services.locale, "appLocaleAsBCP47")
        .get(() => "en-US");
      as._updateDynamicPrefs();
      assert.isTrue(PREFS_CONFIG.get(FEATURE_ENABLED_PREF).value);
    });
    it("should turn off when locale is not supported", () => {
      stub.get(() => "US");
      sandbox.stub(global.Services.locale, "appLocaleAsBCP47").get(() => "fr");
      as._updateDynamicPrefs();
      assert.isFalse(PREFS_CONFIG.get(FEATURE_ENABLED_PREF).value);
    });
    it("should turn off when region and locale are both not supported", () => {
      stub.get(() => "FR");
      sandbox.stub(global.Services.locale, "appLocaleAsBCP47").get(() => "fr");
      as._updateDynamicPrefs();
      assert.isFalse(PREFS_CONFIG.get(FEATURE_ENABLED_PREF).value);
    });
  });
  describe("discoverystream.region-basic-layout config", () => {
    let getStringPrefStub;
    beforeEach(() => {
      getStringPrefStub = sandbox.stub(global.Services.prefs, "getStringPref");
      sandbox.stub(global.Region, "home").get(() => "CA");
      sandbox
        .stub(global.Services.locale, "appLocaleAsBCP47")
        .get(() => "en-CA");
    });
    it("should enable 7 row layout pref if no basic config is set and no geo is set", () => {
      getStringPrefStub
        .withArgs(
          "browser.newtabpage.activity-stream.discoverystream.region-basic-config"
        )
        .returns("");
      sandbox.stub(global.Region, "home").get(() => "");

      as._updateDynamicPrefs();

      assert.isFalse(
        PREFS_CONFIG.get("discoverystream.region-basic-layout").value
      );
    });
    it("should enable 1 row layout pref based on region layout pref", () => {
      getStringPrefStub
        .withArgs(
          "browser.newtabpage.activity-stream.discoverystream.region-basic-config"
        )
        .returns("CA");

      as._updateDynamicPrefs();

      assert.isTrue(
        PREFS_CONFIG.get("discoverystream.region-basic-layout").value
      );
    });
    it("should enable 7 row layout pref based on region layout pref", () => {
      getStringPrefStub
        .withArgs(
          "browser.newtabpage.activity-stream.discoverystream.region-basic-config"
        )
        .returns("");

      as._updateDynamicPrefs();

      assert.isFalse(
        PREFS_CONFIG.get("discoverystream.region-basic-layout").value
      );
    });
  });
  describe("_updateDynamicPrefs topstories default value", () => {
    let getVariableStub;
    let getBoolPrefStub;
    let appLocaleAsBCP47Stub;
    beforeEach(() => {
      getVariableStub = sandbox.stub(
        global.NimbusFeatures.pocketNewtab,
        "getVariable"
      );
      appLocaleAsBCP47Stub = sandbox.stub(
        global.Services.locale,
        "appLocaleAsBCP47"
      );

      getBoolPrefStub = sandbox.stub(global.Services.prefs, "getBoolPref");
      getBoolPrefStub
        .withArgs("browser.newtabpage.activity-stream.feeds.section.topstories")
        .returns(true);

      appLocaleAsBCP47Stub.get(() => "en-US");

      sandbox.stub(global.Region, "home").get(() => "US");

      getVariableStub.withArgs("regionStoriesConfig").returns("US,CA");
    });
    it("should be false with no geo/locale", () => {
      appLocaleAsBCP47Stub.get(() => "");
      sandbox.stub(global.Region, "home").get(() => "");

      as._updateDynamicPrefs();

      assert.isFalse(PREFS_CONFIG.get("feeds.system.topstories").value);
    });
    it("should be false with no geo but an allowed locale", () => {
      appLocaleAsBCP47Stub.get(() => "");
      sandbox.stub(global.Region, "home").get(() => "");
      appLocaleAsBCP47Stub.get(() => "en-US");
      getVariableStub
        .withArgs("localeListConfig")
        .returns("en-US,en-CA,en-GB")
        // We only have this pref set to trigger a close to real situation.
        .withArgs(
          "browser.newtabpage.activity-stream.discoverystream.region-stories-block"
        )
        .returns("FR");

      as._updateDynamicPrefs();

      assert.isFalse(PREFS_CONFIG.get("feeds.system.topstories").value);
    });
    it("should be false with unexpected geo", () => {
      sandbox.stub(global.Region, "home").get(() => "NOGEO");

      as._updateDynamicPrefs();

      assert.isFalse(PREFS_CONFIG.get("feeds.system.topstories").value);
    });
    it("should be false with expected geo and unexpected locale", () => {
      appLocaleAsBCP47Stub.get(() => "no-LOCALE");

      as._updateDynamicPrefs();

      assert.isFalse(PREFS_CONFIG.get("feeds.system.topstories").value);
    });
    it("should be true with expected geo and locale", () => {
      as._updateDynamicPrefs();
      assert.isTrue(PREFS_CONFIG.get("feeds.system.topstories").value);
    });
    it("should be false after expected geo and locale then unexpected", () => {
      sandbox
        .stub(global.Region, "home")
        .onFirstCall()
        .get(() => "US")
        .onSecondCall()
        .get(() => "NOGEO");

      as._updateDynamicPrefs();
      as._updateDynamicPrefs();

      assert.isFalse(PREFS_CONFIG.get("feeds.system.topstories").value);
    });
    it("should be true with updated pref change", () => {
      appLocaleAsBCP47Stub.get(() => "en-GB");
      sandbox.stub(global.Region, "home").get(() => "GB");
      getVariableStub.withArgs("regionStoriesConfig").returns("GB");

      as._updateDynamicPrefs();

      assert.isTrue(PREFS_CONFIG.get("feeds.system.topstories").value);
    });
    it("should be true with allowed locale in non US region", () => {
      appLocaleAsBCP47Stub.get(() => "en-CA");
      sandbox.stub(global.Region, "home").get(() => "DE");
      getVariableStub.withArgs("localeListConfig").returns("en-US,en-CA,en-GB");

      as._updateDynamicPrefs();

      assert.isTrue(PREFS_CONFIG.get("feeds.system.topstories").value);
    });
  });
  describe("_updateDynamicPrefs topstories delayed default value", () => {
    let clock;
    beforeEach(() => {
      clock = sinon.useFakeTimers();

      // Have addObserver cause prefHasUserValue to now return true then observe
      sandbox.stub(global.Services.obs, "addObserver").callsFake(() => {
        setTimeout(() => {
          Services.obs.notifyObservers("US", "browser-region-updated");
        });
      });
    });
    afterEach(() => clock.restore());

    it("should set false with unexpected geo", () => {
      sandbox
        .stub(global.Services.prefs, "getStringPref")
        .withArgs("browser.search.region")
        .returns("NOGEO");

      as._updateDynamicPrefs();

      clock.tick(1);

      assert.isFalse(PREFS_CONFIG.get("feeds.system.topstories").value);
    });
    it("should set true with expected geo and locale", () => {
      sandbox
        .stub(global.NimbusFeatures.pocketNewtab, "getVariable")
        .withArgs("regionStoriesConfig")
        .returns("US");

      sandbox.stub(global.Services.prefs, "getBoolPref").returns(true);
      sandbox
        .stub(global.Services.locale, "appLocaleAsBCP47")
        .get(() => "en-US");

      as._updateDynamicPrefs();
      clock.tick(1);

      assert.isTrue(PREFS_CONFIG.get("feeds.system.topstories").value);
    });
    it("should not change default even with expected geo and locale", () => {
      as._defaultPrefs.set("feeds.system.topstories", false);
      sandbox
        .stub(global.Services.prefs, "getStringPref")
        .withArgs(
          "browser.newtabpage.activity-stream.discoverystream.region-stories-config"
        )
        .returns("US");

      sandbox
        .stub(global.Services.locale, "appLocaleAsBCP47")
        .get(() => "en-US");

      as._updateDynamicPrefs();
      clock.tick(1);

      assert.isFalse(PREFS_CONFIG.get("feeds.system.topstories").value);
    });
    it("should set false with geo blocked", () => {
      sandbox
        .stub(global.Services.prefs, "getStringPref")
        .withArgs(
          "browser.newtabpage.activity-stream.discoverystream.region-stories-config"
        )
        .returns("US")
        .withArgs(
          "browser.newtabpage.activity-stream.discoverystream.region-stories-block"
        )
        .returns("US");

      sandbox.stub(global.Services.prefs, "getBoolPref").returns(true);
      sandbox
        .stub(global.Services.locale, "appLocaleAsBCP47")
        .get(() => "en-US");

      as._updateDynamicPrefs();
      clock.tick(1);

      assert.isFalse(PREFS_CONFIG.get("feeds.system.topstories").value);
    });
  });
  describe("searchs shortcuts shouldPin pref", () => {
    const SEARCH_SHORTCUTS_SEARCH_ENGINES_PREF =
      "improvesearch.topSiteSearchShortcuts.searchEngines";
    let stub;

    beforeEach(() => {
      stub = sandbox.stub(global.Region, "home");
    });

    it("should be an empty string when no geo is available", () => {
      stub.get(() => "");
      as._updateDynamicPrefs();
      assert.equal(
        PREFS_CONFIG.get(SEARCH_SHORTCUTS_SEARCH_ENGINES_PREF).value,
        ""
      );
    });

    it("should be 'baidu' in China", () => {
      stub.get(() => "CN");
      as._updateDynamicPrefs();
      assert.equal(
        PREFS_CONFIG.get(SEARCH_SHORTCUTS_SEARCH_ENGINES_PREF).value,
        "baidu"
      );
    });

    it("should be 'yandex' in Russia, Belarus, Kazakhstan, and Turkey", () => {
      const geos = ["BY", "KZ", "RU", "TR"];
      for (const geo of geos) {
        stub.get(() => geo);
        as._updateDynamicPrefs();
        assert.equal(
          PREFS_CONFIG.get(SEARCH_SHORTCUTS_SEARCH_ENGINES_PREF).value,
          "yandex"
        );
      }
    });

    it("should be 'google,amazon' in Germany, France, the UK, Japan, Italy, and the US", () => {
      const geos = ["DE", "FR", "GB", "IT", "JP", "US"];
      for (const geo of geos) {
        stub.returns(geo);
        as._updateDynamicPrefs();
        assert.equal(
          PREFS_CONFIG.get(SEARCH_SHORTCUTS_SEARCH_ENGINES_PREF).value,
          "google,amazon"
        );
      }
    });

    it("should be 'google' elsewhere", () => {
      // A selection of other geos
      const geos = ["BR", "CA", "ES", "ID", "IN"];
      for (const geo of geos) {
        stub.get(() => geo);
        as._updateDynamicPrefs();
        assert.equal(
          PREFS_CONFIG.get(SEARCH_SHORTCUTS_SEARCH_ENGINES_PREF).value,
          "google"
        );
      }
    });
  });
});
