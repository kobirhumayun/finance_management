export type PaymentProvider = {
  id: string;
  name: string;
  logo: string;
  category: "bank" | "mobile";
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
