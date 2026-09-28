import dotenv from "dotenv"

dotenv.config()

const paystackSecretKey = process.env.PAYSTACK_SECRET_KEY

fetch("https://api.paystack.co/transaction/initialize", {
    method: "POST",
    headers: {
        Authorization: `Bearer ${paystackSecretKey}`,
        "Content-Type": "application/json"
    },
    body: JSON.stringify(...)
})