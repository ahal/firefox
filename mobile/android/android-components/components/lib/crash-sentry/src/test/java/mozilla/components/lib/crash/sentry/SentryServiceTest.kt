/* This Source Code Form is subject to the terms of the Mozilla Public
 * License, v. 2.0. If a copy of the MPL was not distributed with this
 * file, You can obtain one at http://mozilla.org/MPL/2.0/. */

package mozilla.components.lib.crash.sentry

import androidx.test.ext.junit.runners.AndroidJUnit4
import io.sentry.Sentry
import io.sentry.SentryLevel
import junit.framework.TestCase.assertEquals
import junit.framework.TestCase.assertFalse
import junit.framework.TestCase.assertNull
import junit.framework.TestCase.assertTrue
import mozilla.components.concept.base.crash.Breadcrumb
import mozilla.components.lib.crash.Crash
import mozilla.components.support.test.robolectric.testContext
import org.junit.Before
import org.junit.Test
import org.junit.runner.RunWith
import org.mockito.Mockito.never
import org.mockito.Mockito.spy
import org.mockito.Mockito.times
import org.mockito.Mockito.verify
import java.util.Date
import mozilla.components.concept.base.crash.Breadcrumb as MozillaBreadcrumb

@RunWith(AndroidJUnit4::class)
class SentryServiceTest {
    class TestException : Exception()

    @Before
    fun setup() {
        Sentry.close()
    }

    @Test
    fun `WHEN calling initIfNeeded THEN initialize sentry once`() {
        val service = spy(
            SentryService(
                testContext,
                "https://not:real6@sentry.prod.example.net/405",
                sendCaughtExceptions = false,
            ),
        )

        assertFalse(service.isInitialized)

        service.initIfNeeded()

        assertTrue(service.isInitialized)

        service.initIfNeeded()

        verify(service, times(1)).initSentry()
    }

    @Test
    fun `WHEN report a uncaught exception THEN forward a fatal exception to the Sentry sdk`() {
        val service = spy(
            SentryService(
                testContext,
                "https://not:real6@sentry.prod.example.net/405",
            ),
        )

        val exception = RuntimeException("Hello World")
        val breadcrumbs = arrayListOf<Breadcrumb>()

        val crash = Crash.UncaughtExceptionCrash(0, exception, breadcrumbs)
        service.report(crash)

        verify(service).prepareReport(breadcrumbs, SentryLevel.FATAL, crash)
        verify(service).reportToSentry(exception)
    }

    @Test
    fun `GIVEN a main process native crash WHEN reporting THEN forward to a fatal crash the Sentry sdk`() {
        val service = spy(
            SentryService(
                applicationContext = testContext,
                dsn = "https://not:real6@sentry.prod.example.net/405",
                sendEventForNativeCrashes = true,
            ),
        )

        val breadcrumbs = arrayListOf<Breadcrumb>()
        val nativeCrash = Crash.NativeCodeCrash(
            timestamp = 0,
            minidumpPath = "",
            extrasPath = "",
            processVisibility = Crash.NativeCodeCrash.PROCESS_VISIBILITY_MAIN,
            processType = "main",
            breadcrumbs = breadcrumbs,
            remoteType = null,
        )

        service.report(nativeCrash)

        verify(service).prepareReport(breadcrumbs, SentryLevel.FATAL, nativeCrash)
        verify(service).reportToSentry(nativeCrash)
    }

    @Test
    fun `GIVEN a foreground child process native crash WHEN reporting THEN forward an error to the Sentry sdk`() {
        val service = spy(
            SentryService(
                applicationContext = testContext,
                dsn = "https://not:real6@sentry.prod.example.net/405",
                sendEventForNativeCrashes = true,
            ),
        )

        val breadcrumbs = arrayListOf<Breadcrumb>()
        val nativeCrash = Crash.NativeCodeCrash(
            timestamp = 0,
            minidumpPath = "",
            extrasPath = "",
            processVisibility = Crash.NativeCodeCrash.PROCESS_VISIBILITY_FOREGROUND_CHILD,
            processType = "content",
            breadcrumbs = breadcrumbs,
            remoteType = null,
        )

        service.report(nativeCrash)

        verify(service).prepareReport(breadcrumbs, SentryLevel.ERROR, nativeCrash)
        verify(service).reportToSentry(nativeCrash)
    }

    @Test
    fun `GIVEN a background child process native crash WHEN reporting THEN forward an error to the Sentry sdk`() {
        val service = spy(
            SentryService(
                applicationContext = testContext,
                dsn = "https://not:real6@sentry.prod.example.net/405",
                sendEventForNativeCrashes = true,
            ),
        )

        val breadcrumbs = arrayListOf<Breadcrumb>()
        val nativeCrash = Crash.NativeCodeCrash(
            timestamp = 0,
            minidumpPath = "",
            extrasPath = "",
            processVisibility = Crash.NativeCodeCrash.PROCESS_VISIBILITY_BACKGROUND_CHILD,
            processType = "utility",
            breadcrumbs = breadcrumbs,
            remoteType = null,
        )

        service.report(nativeCrash)

        verify(service).prepareReport(breadcrumbs, SentryLevel.ERROR, nativeCrash)
        verify(service).reportToSentry(nativeCrash)
    }

    @Test
    fun `GIVEN sendEventForNativeCrashes is false WHEN reporting a native crash THEN DO NOT forward to the Sentry sdk`() {
        val service = spy(
            SentryService(
                applicationContext = testContext,
                dsn = "https://not:real6@sentry.prod.example.net/405",
                sendEventForNativeCrashes = false,
            ),
        )

        val breadcrumbs = arrayListOf<Breadcrumb>()
        val nativeCrash = Crash.NativeCodeCrash(
            timestamp = 0,
            minidumpPath = "",
            extrasPath = "",
            processVisibility = Crash.NativeCodeCrash.PROCESS_VISIBILITY_FOREGROUND_CHILD,
            processType = "content",
            breadcrumbs = breadcrumbs,
            remoteType = null,
        )

        val result = service.report(nativeCrash)

        verify(service, times(0)).prepareReport(breadcrumbs, SentryLevel.ERROR, nativeCrash)
        verify(service, times(0)).reportToSentry(nativeCrash)
        assertNull(result)
    }

    @Test
    fun `WHEN createMessage THEN create a message version of the Native crash`() {
        val service = SentryService(
            applicationContext = testContext,
            dsn = "https://not:real6@sentry.prod.example.net/405",
            sendEventForNativeCrashes = false,
        )

        val breadcrumbs = arrayListOf<Breadcrumb>()
        val nativeCrash = Crash.NativeCodeCrash(
            timestamp = 0,
            minidumpPath = "",
            extrasPath = "",
            processVisibility = Crash.NativeCodeCrash.PROCESS_VISIBILITY_MAIN,
            processType = "main",
            breadcrumbs = breadcrumbs,
            remoteType = null,
        )

        val result = service.createMessage(nativeCrash)
        val expected =
            "NativeCodeCrash(fatal=${nativeCrash.isFatal}, processVisibility=${nativeCrash.processVisibility})"

        assertEquals(expected, result)
    }

    @Test
    fun `GIVEN MozillaBreadcrumb WHEN calling toSentryBreadcrumb THEN parse it to a SentryBreadcrumb`() {
        val mozillaBreadcrumb = MozillaBreadcrumb(
            message = "message",
            data = mapOf("key" to "value"),
            category = "category",
            level = MozillaBreadcrumb.Level.INFO,
            type = MozillaBreadcrumb.Type.DEFAULT,
            date = Date(1640995200L), // 2022-01-01
        )
        val sentryBreadcrumb = mozillaBreadcrumb.toSentryBreadcrumb()

        assertEquals(mozillaBreadcrumb.message, sentryBreadcrumb.message)
        assertEquals(mozillaBreadcrumb.data["key"], sentryBreadcrumb.getData("key"))
        assertEquals(mozillaBreadcrumb.category, sentryBreadcrumb.category)
        assertEquals(SentryLevel.INFO, sentryBreadcrumb.level)
        assertEquals(MozillaBreadcrumb.Type.DEFAULT.value, sentryBreadcrumb.type)
        assertEquals(mozillaBreadcrumb.date, sentryBreadcrumb.timestamp)
    }

    @Test
    fun `GIVEN MozillaBreadcrumb level WHEN calling toSentryBreadcrumbLevel THEN parse it to a SentryBreadcrumbLevel`() {
        assertEquals(MozillaBreadcrumb.Level.CRITICAL.toSentryBreadcrumbLevel(), SentryLevel.FATAL)
        assertEquals(MozillaBreadcrumb.Level.ERROR.toSentryBreadcrumbLevel(), SentryLevel.ERROR)
        assertEquals(MozillaBreadcrumb.Level.WARNING.toSentryBreadcrumbLevel(), SentryLevel.WARNING)
        assertEquals(MozillaBreadcrumb.Level.INFO.toSentryBreadcrumbLevel(), SentryLevel.INFO)
        assertEquals(MozillaBreadcrumb.Level.DEBUG.toSentryBreadcrumbLevel(), SentryLevel.DEBUG)
    }

    @Test
    fun `GIVEN sending caught exceptions disabled WHEN reporting a caught exception THEN do nothing`() {
        val service = spy(
            SentryService(
                testContext,
                "https://not:real6@sentry.prod.example.net/405",
                sendCaughtExceptions = false,
            ),
        )

        val exception = RuntimeException("Hello World")
        val breadcrumbs = arrayListOf<Breadcrumb>()

        service.report(exception, breadcrumbs)
        verify(service, never()).prepareReport(breadcrumbs, SentryLevel.INFO, null)
        verify(service, never()).prepareReport(breadcrumbs, SentryLevel.FATAL, null)
        verify(service, never()).reportToSentry(exception)
    }

    @Test
    fun `GIVEN sending caught exceptions enabled WHEN reporting a caught exception THEN forward it to Sentry SDK with level INFO`() {
        val service = spy(
            // Sending caught exceptions is enabled by default.
            SentryService(
                testContext,
                "https://not:real6@sentry.prod.example.net/405",
            ),
        )

        val exception = RuntimeException("Hello World")
        val breadcrumbs = arrayListOf<Breadcrumb>()

        service.report(exception, breadcrumbs)

        verify(service).prepareReport(breadcrumbs, SentryLevel.INFO, null)
        verify(service).reportToSentry(exception)
    }
}
