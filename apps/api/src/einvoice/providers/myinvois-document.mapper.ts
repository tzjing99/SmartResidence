import { createHash } from 'node:crypto';
import type { EInvoiceDocument } from '@smartresidence/shared-types';

/**
 * Minimal MyInvois JSON invoice payload derived from our typed document snapshot.
 *
 * TODO(live-validation): Confirm field names and nesting against the current LHDN
 * document type version schema; production submissions also require a digital
 * signature envelope that is not generated here yet.
 */
export function toMyInvoisDocumentJson(doc: EInvoiceDocument): Record<string, unknown> {
  return {
    _D: 'urn:oasis:names:specification:ubl:schema:xsd:Invoice-2',
    Invoice: [
      {
        ID: [{ _: doc.invoiceNumber }],
        IssueDate: [{ _: doc.issueDate }],
        IssueTime: [{ _: doc.issueTime }],
        InvoiceTypeCode: [{ _: doc.eInvoiceTypeCode, listVersionID: doc.eInvoiceVersion }],
        DocumentCurrencyCode: [{ _: doc.documentCurrencyCode }],
        AccountingSupplierParty: [partyBlock(doc.supplier)],
        AccountingCustomerParty: [partyBlock(doc.buyer)],
        InvoiceLine: doc.lines.map((line) => ({
          ID: [{ _: line.id }],
          InvoicedQuantity: [{ _: line.quantity, unitCode: 'C62' }],
          LineExtensionAmount: [{ _: line.lineAmount, currencyID: doc.documentCurrencyCode }],
          Item: [{ Description: [{ _: line.description }] }],
          Price: [{ PriceAmount: [{ _: line.unitPrice, currencyID: doc.documentCurrencyCode }] }],
          TaxTotal: [
            {
              TaxAmount: [{ _: line.taxAmount, currencyID: doc.documentCurrencyCode }],
              TaxSubtotal: [
                {
                  TaxableAmount: [{ _: line.lineAmount, currencyID: doc.documentCurrencyCode }],
                  TaxAmount: [{ _: line.taxAmount, currencyID: doc.documentCurrencyCode }],
                  TaxCategory: [
                    {
                      ID: [{ _: line.taxType }],
                      Percent: [{ _: line.taxRate }],
                    },
                  ],
                },
              ],
            },
          ],
        })),
        TaxTotal: [
          {
            TaxAmount: [{ _: doc.taxAmount, currencyID: doc.documentCurrencyCode }],
          },
        ],
        LegalMonetaryTotal: [
          {
            TaxExclusiveAmount: [
              { _: doc.taxExclusiveAmount, currencyID: doc.documentCurrencyCode },
            ],
            TaxInclusiveAmount: [
              { _: doc.taxInclusiveAmount, currencyID: doc.documentCurrencyCode },
            ],
            PayableAmount: [{ _: doc.totalPayableAmount, currencyID: doc.documentCurrencyCode }],
          },
        ],
      },
    ],
  };
}

function partyBlock(party: EInvoiceDocument['supplier']): Record<string, unknown> {
  return {
    Party: [
      {
        IndustryClassificationCode: party.msicCode
          ? [{ _: party.msicCode, name: party.businessActivityDescription ?? '' }]
          : undefined,
        PartyIdentification: [
          { ID: [{ _: party.tin, schemeID: 'TIN' }] },
          ...(party.registrationNo ? [{ ID: [{ _: party.registrationNo, schemeID: 'BRN' }] }] : []),
          ...(party.sstRegistrationNo
            ? [{ ID: [{ _: party.sstRegistrationNo, schemeID: 'SST' }] }]
            : []),
        ],
        PartyLegalEntity: [{ RegistrationName: [{ _: party.name }] }],
        Contact: [
          {
            ElectronicMail: party.email ? [{ _: party.email }] : undefined,
            Telephone: party.phone ? [{ _: party.phone }] : undefined,
          },
        ],
        PostalAddress: [
          {
            AddressLine: party.address.lines.map((line) => ({ Line: [{ _: line }] })),
            CityName: [{ _: party.address.city }],
            PostalZone: [{ _: party.address.postcode }],
            CountrySubentityCode: [{ _: party.address.state }],
            Country: [{ IdentificationCode: [{ _: party.address.countryCode }] }],
          },
        ],
      },
    ],
  };
}

/** Base64 payload + SHA-256 hash required by POST /api/v1.0/documentsubmissions/. */
export function encodeMyInvoisDocument(doc: EInvoiceDocument): {
  format: 'JSON';
  document: string;
  documentHash: string;
  codeNumber: string;
} {
  const json = JSON.stringify(toMyInvoisDocumentJson(doc));
  const document = Buffer.from(json, 'utf8').toString('base64');
  const documentHash = createHash('sha256').update(json, 'utf8').digest('hex');
  return { format: 'JSON', document, documentHash, codeNumber: doc.invoiceNumber };
}
