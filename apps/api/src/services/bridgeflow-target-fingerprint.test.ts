/**
 * ===========================================================================
 *  TARGET FINGERPRINT — pack'in KURALI + koşunun DEĞERİ
 *
 *  Bu suite'in koruduğu şey, sessiz bir adreslenemezlikti: pack hedefi
 *  `idPrefix` / `keyPath` ile bildiriyordu (bir KURAL), builder ise yalnız
 *  literal okuyordu (bir DEĞER). Zincir sonuna kadar yürünüyor, hedef
 *  `undefined` dönüyor ve resolve adımı cihaza hiç sormadan düşüyordu — üstelik
 *  sebebini söylemeden. `nesy.target.route-row` cihazda tam bunu yaptı.
 *
 *  İkinci koruma: eksik entity key ASLA boş dizgiye çevrilmemeli. `route_row_`
 *  ya da `""` ile eşleme, "istenen kayıt" yerine "eline geçen ilk kayıt"
 *  demektir ve o hata her oracle yeşilken veriyi yanlış yapar.
 * ===========================================================================
 */
import { describe, expect, it } from 'vitest'
import type { TargetDefinition, TargetResolutionStrategy } from '@nesy/domain-pack-contracts'

import { buildTargetFingerprint } from './bridgeflow-target-fingerprint.js'

const target = (chain: readonly TargetResolutionStrategy[]): TargetDefinition => ({
  targetKey: 'test.target.row',
  applicationRef: 'test.app',
  screenRef: 'test.screen',
  displayName: 'Row under test',
  resolution: {
    chain,
    ambiguityPolicy: 'FAIL',
    notFoundPolicy: 'FAIL',
    deadlineMs: 10_000,
    reverifyBeforeAction: true,
  },
})

describe('buildTargetFingerprint — per-occurrence identity', () => {
  it('idPrefix ile entity key birleşerek id selector kurar', () => {
    const fingerprint = buildTargetFingerprint(
      target([{ kind: 'ACCESSIBILITY_ID', selector: { idPrefix: 'route_row_' }, establishesIdentity: true }]),
      '31',
    )

    expect(fingerprint?.selector).toEqual({ by: 'id', value: 'route_row_31' })
    expect(fingerprint?.expectedId).toBe('route_row_31')
  })

  it('entity key yoksa idPrefix ATLANIR, prefix tek başına selector olmaz', () => {
    // `route_row_` her satırla eşleşir; prefix bir kural, kimlik değil.
    const chain: readonly TargetResolutionStrategy[] = [
      { kind: 'ACCESSIBILITY_ID', selector: { idPrefix: 'route_row_' }, establishesIdentity: true },
    ]
    expect(buildTargetFingerprint(target(chain))).toBeUndefined()
    expect(buildTargetFingerprint(target(chain), '')).toBeUndefined()
  })

  it('ENTITY_BINDING kimliği koşunun key’inden alır — pack’teki literal geçilir', () => {
    // Fiscal rota ölçümü: satırın GÖRÜNEN metni "31 *", routeCode ise "31".
    // Kimlik koşudan gelmezse yanlış metinle aranır ve satır bulunamaz.
    const fingerprint = buildTargetFingerprint(
      target([
        { kind: 'ENTITY_BINDING', selector: { keyPath: 'routeCode', entityKey: 'yazıldığı-an-bilinen' }, establishesIdentity: true },
      ]),
      '31 *',
    )

    expect(fingerprint?.selector).toEqual({ by: 'text', value: '31 *' })
    expect(fingerprint?.rowKey).toBe('31 *')
  })

  it('TEXT_MATCH bir SABİTİ adlandırır; literal entity key’i yener', () => {
    const fingerprint = buildTargetFingerprint(
      target([{ kind: 'TEXT_MATCH', selector: { text: 'OK', exact: true }, establishesIdentity: true }]),
      '31',
    )

    expect(fingerprint?.selector).toEqual({ by: 'text', value: 'OK', exact: true })
  })

  it('zincir sırası korunur: kullanılamayan halka atlanır, sonraki denenir', () => {
    // Cihazda ölçülen gerçek durum: satırların kendine ait id’si YOK
    // (hepsi android:id/text1), dolayısıyla kimlik metinden gelmek zorunda.
    const fingerprint = buildTargetFingerprint(
      target([
        { kind: 'ACCESSIBILITY_ID', selector: { idPrefix: 'route_row_' }, establishesIdentity: true },
        { kind: 'ENTITY_BINDING', selector: { keyPath: 'routeCode' }, establishesIdentity: true },
      ]),
      undefined,
    )
    expect(fingerprint).toBeUndefined()

    const withKey = buildTargetFingerprint(
      target([
        { kind: 'ENTITY_BINDING', selector: { keyPath: 'routeCode' }, establishesIdentity: true },
        { kind: 'TEXT_MATCH', selector: { text: 'sonraki' }, establishesIdentity: true },
      ]),
      '3',
    )
    expect(withKey?.selector).toEqual({ by: 'text', value: '3' })
  })

  it('ROW_INDEX_HINT entity key varken de kimlik OLMAZ, yalnız hint kalır', () => {
    const fingerprint = buildTargetFingerprint(
      target([
        { kind: 'ENTITY_BINDING', selector: { keyPath: 'routeCode' }, establishesIdentity: true },
        { kind: 'ROW_INDEX_HINT', selector: { rowIndex: 29 }, establishesIdentity: false },
      ]),
      '31',
    )

    expect(fingerprint?.selector).toEqual({ by: 'text', value: '31', rowIndexHint: 29 })
    expect(fingerprint?.rowIndexHint).toBe(29)
  })

  it('yalnız ROW_INDEX_HINT bildiren hedef adreslenemez kalır', () => {
    expect(
      buildTargetFingerprint(
        target([{ kind: 'ROW_INDEX_HINT', selector: { rowIndex: 29 }, establishesIdentity: false }]),
        '31',
      ),
    ).toBeUndefined()
  })
})
