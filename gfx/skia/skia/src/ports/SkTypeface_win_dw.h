/*
 * Copyright 2014 Google Inc.
 *
 * Use of this source code is governed by a BSD-style license that can be
 * found in the LICENSE file.
 */

#ifndef SkTypeface_win_dw_DEFINED
#define SkTypeface_win_dw_DEFINED

#include "include/core/SkFontArguments.h"
#include "include/core/SkTypeface.h"
#include "include/private/base/SkAPI.h"
#include "src/base/SkLeanWindows.h"
#include "src/core/SkAdvancedTypefaceMetrics.h"
#include "src/core/SkTypefaceCache.h"
#include "src/utils/win/SkDWrite.h"
#include "src/utils/win/SkHRESULT.h"
#include "src/utils/win/SkTScopedComPtr.h"

#include <dwrite.h>
#include <dwrite_1.h>
#include <dwrite_2.h>
#include <dwrite_3.h>

#if !defined(__MINGW32__) && WINVER < 0x0A00
#include "mozilla/gfx/dw-extra.h"
#endif

class SkFontDescriptor;
struct SkScalerContextRec;

/* dwrite_3.h incorrectly uses NTDDI_VERSION to hide immutable interfaces (it should only be used to
   gate changes to public ABI). The implementation files can (and must) get away with including
   SkDWriteNTDDI_VERSION.h which simply unsets NTDDI_VERSION, but this doesn't work well for this
   header which can be included in SkTypeface.cpp. Instead, ensure that any declarations hidden
   behind the NTDDI_VERSION are forward (backward?) declared here in case dwrite_3.h did not declare
   them. */
interface IDWriteFontFace4;
interface IDWriteFontFace7;

class DWriteFontTypeface : public SkTypeface {
public:
    struct Loaders : public SkNVRefCnt<Loaders> {
        Loaders(IDWriteFactory* factory,
                  IDWriteFontFileLoader* fontFileLoader,
                  IDWriteFontCollectionLoader* fontCollectionLoader)
            : fFactory(SkRefComPtr(factory))
            , fDWriteFontFileLoader(SkRefComPtr(fontFileLoader))
            , fDWriteFontCollectionLoader(SkRefComPtr(fontCollectionLoader))
        {}
        Loaders(const Loaders&) = delete;
        Loaders& operator=(const Loaders&) = delete;
        Loaders(Loaders&&) = delete;
        Loaders& operator=(Loaders&&) = delete;
        ~Loaders();

        SkTScopedComPtr<IDWriteFactory> fFactory;
        SkTScopedComPtr<IDWriteFontFileLoader> fDWriteFontFileLoader;
        SkTScopedComPtr<IDWriteFontCollectionLoader> fDWriteFontCollectionLoader;
    };

    static constexpr SkTypeface::FactoryId FactoryId = SkSetFourByteTag('d','w','r','t');
    static sk_sp<SkTypeface> SK_SPI MakeFromStream(std::unique_ptr<SkStreamAsset>,
                                                   const SkFontArguments&);

    ~DWriteFontTypeface() override;
private:
    DWriteFontTypeface(const SkFontStyle& style,
                       IDWriteFactory* factory,
                       IDWriteFontFace* fontFace,
                       IDWriteFont* font,
                       IDWriteFontFamily* fontFamily,
                       sk_sp<Loaders> loaders,
                       const SkFontArguments::Palette&);
    HRESULT initializePalette();

public:
    SkTScopedComPtr<IDWriteFactory> fFactory;
    SkTScopedComPtr<IDWriteFactory2> fFactory2;
    SkTScopedComPtr<IDWriteFontFamily> fDWriteFontFamily;
    SkTScopedComPtr<IDWriteFont> fDWriteFont;
    SkTScopedComPtr<IDWriteFontFace> fDWriteFontFace;
    SkTScopedComPtr<IDWriteFontFace1> fDWriteFontFace1;
    SkTScopedComPtr<IDWriteFontFace2> fDWriteFontFace2;
    SkTScopedComPtr<IDWriteFontFace4> fDWriteFontFace4;
#if !SK_DISABLE_DIRECTWRITE_COLRv1 && (DWRITE_CORE || (defined(NTDDI_WIN11_ZN) && NTDDI_VERSION >= NTDDI_WIN11_ZN))
    // Once WDK 10.0.25357.0 or newer is required to build, fDWriteFontFace7 can be a smart pointer.
    // If a smart pointer is used then ~DWriteFontTypeface must call the smart pointer's destructor,
    // which must include code to Release the IDWriteFontFace7, but there may be no IDWriteFontFace7
    // other than the forward declaration. Skia should never declare an IDWriteFontFace7 (other than
    // copying the entire interface) for ODR reasons. This header cannot detect if there will be a
    // full declaration of IDWriteFontFace7 at the ~DWriteFontTypeface implementation because of
    // NTDDI_VERSION shenanigains, otherwise this defintition could just be ifdef'ed.
    //SkTScopedComPtr<IDWriteFontFace7> fDWriteFontFace7;
    IDWriteFontFace7* fDWriteFontFace7 = nullptr;
#endif  // !SK_DISABLE_DIRECTWRITE_COLRv1 && (DWRITE_CORE || (defined(NTDDI_WIN11_ZN) && NTDDI_VERSION >= NTDDI_WIN11_ZN))
    bool fIsColorFont;

    std::unique_ptr<SkFontArguments::Palette::Override> fRequestedPaletteEntryOverrides;
    SkFontArguments::Palette fRequestedPalette;

    size_t fPaletteEntryCount;
    std::unique_ptr<SkColor[]> fPalette;
    std::unique_ptr<DWRITE_COLOR_F[]> fDWPalette;

    static SkFontStyle GetStyle(IDWriteFont* font, IDWriteFontFace* fontFace);
    static sk_sp<DWriteFontTypeface> Make(
        IDWriteFactory* factory,
        IDWriteFontFace* fontFace,
        IDWriteFont* font,
        IDWriteFontFamily* fontFamily,
        sk_sp<Loaders> loaders,
        const SkFontArguments::Palette& palette);

    static DWriteFontTypeface* Create(IDWriteFactory* factory,
                                      IDWriteFontFace* fontFace,
                                      SkFontStyle aStyle,
                                      DWRITE_RENDERING_MODE aRenderingMode,
                                      float aGamma,
                                      float aContrast,
                                      float aClearTypeLevel) {
        DWriteFontTypeface* typeface =
                new DWriteFontTypeface(aStyle, factory, fontFace,
                                       nullptr, nullptr,
                                       nullptr, SkFontArguments::Palette{0, nullptr, 0});
        typeface->fRenderingMode = aRenderingMode;
        typeface->fGamma = aGamma;
        typeface->fContrast = aContrast;
        typeface->fClearTypeLevel = aClearTypeLevel;
        return typeface;
    }

    bool ForceGDI() const { return fRenderingMode == DWRITE_RENDERING_MODE_GDI_CLASSIC; }
    DWRITE_RENDERING_MODE GetRenderingMode() const { return fRenderingMode; }
    float GetClearTypeLevel() const { return fClearTypeLevel; }

protected:
    void weak_dispose() const override {
        fLoaders.reset();

        //SkTypefaceCache::Remove(this);
        INHERITED::weak_dispose();
    }

    sk_sp<SkTypeface> onMakeClone(const SkFontArguments&) const override;
    std::unique_ptr<SkStreamAsset> onOpenStream(int* ttcIndex) const override;
    std::unique_ptr<SkScalerContext> onCreateScalerContext(const SkScalerContextEffects&,
                                                           const SkDescriptor*) const override;
    void onFilterRec(SkScalerContextRec*) const override;
    void getGlyphToUnicodeMap(SkUnichar* glyphToUnicode) const override;
    std::unique_ptr<SkAdvancedTypefaceMetrics> onGetAdvancedMetrics() const override;
    void onGetFontDescriptor(SkFontDescriptor*, bool*) const override;
    void onCharsToGlyphs(const SkUnichar* chars, int count, SkGlyphID glyphs[]) const override;
    int onCountGlyphs() const override;
    void getPostScriptGlyphNames(SkString*) const override;
    int onGetUPEM() const override;
    void onGetFamilyName(SkString* familyName) const override;
    bool onGetPostScriptName(SkString*) const override;
    int onGetResourceName(SkString*) const override;
    SkTypeface::LocalizedStrings* onCreateFamilyNameIterator() const override;
    bool onGlyphMaskNeedsCurrentColor() const override;
    int onGetVariationDesignPosition(SkFontArguments::VariationPosition::Coordinate coordinates[],
                                     int coordinateCount) const override;
    int onGetVariationDesignParameters(SkFontParameters::Variation::Axis parameters[],
                                       int parameterCount) const override;
    int onGetTableTags(SkFontTableTag tags[]) const override;
    size_t onGetTableData(SkFontTableTag, size_t offset, size_t length, void* data) const override;
    sk_sp<SkData> onCopyTableData(SkFontTableTag) const override;

private:
    mutable sk_sp<Loaders> fLoaders;
    using INHERITED = SkTypeface;
    DWRITE_RENDERING_MODE fRenderingMode;
    float fGamma;
    float fContrast;
    float fClearTypeLevel;
};

#endif
