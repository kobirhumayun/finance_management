export type PaymentProvider = {
  id: string;
  name: string;
  logo: string;
  category: "bank" | "mobile";
};

type PaymentDestination = {
  providerId: string;
  accountName: string;
  accountNumber: string;
  notes?: string;
};

export const acceptedBanks: PaymentProvider[] = [
  { id: "brac-bank", name: "BRAC Bank", logo: "BB", category: "bank" },
  { id: "dbbl", name: "Dutch-Bangla Bank", logo: "DBBL", category: "bank" },
  { id: "city-bank", name: "The City Bank", logo: "CB", category: "bank" },
  { id: "eastern-bank", name: "Eastern Bank", logo: "EBL", category: "bank" },
];

export const acceptedMobileOperators: PaymentProvider[] = [
  { id: "bkash", name: "bKash", logo: "bK", category: "mobile" },
  { id: "nagad", name: "Nagad", logo: "N", category: "mobile" },
  { id: "rocket", name: "Rocket", logo: "R", category: "mobile" },
  { id: "upay", name: "Upay", logo: "U", category: "mobile" },
];

export const paymentMethodProviders = {
  banks: acceptedBanks,
  mobileOperators: acceptedMobileOperators,
};

export const manualPaymentDetails = {
  recipientName: "Finance Management Ltd.",
  steps: [
    "Use your banking or mobile wallet app to initiate a transfer.",
    "Send the exact invoice amount to one of the accounts listed below.",
    "Copy the transaction or reference number provided by your bank/wallet.",
    "Paste the reference number into the payment form and submit for verification.",
  ],
  bankAccounts: [
    {
      providerId: "brac-bank",
      accountName: "Finance Management Ltd.",
      accountNumber: "0123-456789-01",
      notes: "Corporate current account",
    },
    {
      providerId: "dbbl",
      accountName: "Finance Management Ltd.",
      accountNumber: "211-110-334455",
      notes: "Preferred for large payments",
    },
  ] as PaymentDestination[],
  mobileWallets: [
    {
      providerId: "bkash",
      accountName: "Finance Management Ltd.",
      accountNumber: "01700-000111",
      notes: "Use Send Money option",
    },
    {
      providerId: "nagad",
      accountName: "Finance Management Ltd.",
      accountNumber: "01800-222333",
      notes: "Reference field required",
    },
  ] as PaymentDestination[],
};
