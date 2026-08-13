import { prisma } from "../../../prisma/client";
import { getPixKey } from "./workspace-settings-service";
import { formatBRL, toDecimal } from "./money";
import { FinancialValidationError } from "./lifecycle";

export interface InvoiceData {
  installment: {
    id: string;
    expectedAmount: string;
    formattedAmount: string;
    dueDate: string;
    paymentMethod: string;
    status: string;
  };
  contract: {
    id: string;
    code: string;
    title: string;
  };
  client: {
    name: string;
  };
  pixKey: string;
  pixKeyConfigured: boolean;
}

/**
 * Fetches all data needed to render an invoice for an installment.
 * Returns the installment, contract, client, and workspace PIX key.
 * Throws FinancialValidationError if installment not found.
 */
export async function getInvoiceData(
  installmentId: string,
  tenantId: string
): Promise<InvoiceData> {
  const installment = await prisma.installment.findFirst({
    where: {
      id: installmentId,
      tenantId,
    },
    include: {
      contract: {
        select: {
          id: true,
          code: true,
          title: true,
          client: {
            select: { name: true },
          },
        },
      },
    },
  });

  if (!installment) {
    throw new FinancialValidationError("Installment not found");
  }

  const pixKey = await getPixKey(tenantId);

  return {
    installment: {
      id: installment.id,
      expectedAmount: installment.expectedAmount.toFixed(2),
      formattedAmount: formatBRL(toDecimal(installment.expectedAmount)),
      dueDate: installment.dueDate,
      paymentMethod: installment.paymentMethod,
      status: installment.status,
    },
    contract: {
      id: installment.contract.id,
      code: installment.contract.code,
      title: installment.contract.title ?? "",
    },
    client: {
      name: installment.contract.client?.name ?? "Cliente não informado",
    },
    pixKey,
    pixKeyConfigured: pixKey.length > 0,
  };
}
