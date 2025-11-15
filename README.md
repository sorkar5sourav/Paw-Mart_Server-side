# PawMart Backend API 🐾

A robust Node.js REST API backend for the PawMart platform, handling listings, orders, and user authentication.

## 🚀 Live API

**Deploy Link:** [https://paw-mart-server-side.vercel.app/](https://paw-mart-server-side.vercel.app/)

## 📋 Overview

PawMart Backend is a production-ready Express.js API that manages:

- Pet adoption listings
- Pet product listings
- User orders and purchases
- Authentication and authorization via Firebase
- RESTful endpoints for CRUD operations

## ✨ Key Features

- **Express.js REST API** - Fast, scalable backend framework
- **MongoDB Integration** - Persistent data storage with MongoDB Atlas
- **Firebase Authentication** - Secure JWT token verification
- **CORS Support** - Allows requests from frontend domains
- **Error Handling** - Custom 403 & 500 error handlers
- **Deployed on Vercel** - Serverless deployment with automatic scaling

## 🛠️ Tech Stack

- **Node.js** - JavaScript runtime
- **Express.js** - Web framework
- **MongoDB** - NoSQL database
- **Firebase Admin SDK** - Authentication & verification
- **CORS** - Cross-origin request handling
- **Deployed on Vercel** - Serverless hosting

## 📚 API Endpoints

### Listings Endpoints

| Method   | Endpoint         | Auth Required | Description                            |
| -------- | ---------------- | ------------- | -------------------------------------- |
| `GET`    | `/listings`      | No            | Get all listings (sorted newest first) |
| `POST`   | `/listings`      | Yes           | Create a new listing                   |
| `GET`    | `/listing/:id`   | Yes           | Get a single listing by ID             |
| `PUT`    | `/listings/:id`  | Yes           | Update a listing                       |
| `DELETE` | `/listings/:id`  | Yes           | Delete a listing                       |
| `GET`    | `/user-listings` | Yes           | Get listings by user ID                |

### Orders Endpoints

| Method   | Endpoint                         | Auth Required | Description              |
| -------- | -------------------------------- | ------------- | ------------------------ |
| `POST`   | `/orders`                        | Yes           | Create a new order       |
| `GET`    | `/orders?email=user@example.com` | Yes           | Get orders by user email |
| `DELETE` | `/orders/:id`                    | Yes           | Delete an order          |

### Health Check

| Method | Endpoint | Description                |
| ------ | -------- | -------------------------- |
| `GET`  | `/`      | Check if server is running |

## 🔐 Authentication

All protected endpoints require a Firebase JWT token in the Authorization header:

```
Authorization: Bearer <JWT_TOKEN>
```

The `verifyToken` middleware:

1. Extracts the token from the Authorization header
2. Verifies it with Firebase Admin SDK
3. Returns 401 if token is missing or invalid
4. Returns 403 if access is denied

## 📊 Database Schema

### Listings Collection

```json
{
  "_id": "ObjectId",
  "name": "string",
  "category": "string",
  "price": "number",
  "description": "string",
  "imageUrl": "string",
  "location": "string",
  "pickupDate": "date",
  "email": "string",
  "userName": "string",
  "userId": "string"
}
```

### Orders Collection

```json
{
  "_id": "ObjectId",
  "listingId": "string",
  "listingName": "string",
  "buyerName": "string",
  "email": "string",
  "phone": "string",
  "address": "string",
  "quantity": "number",
  "price": "number",
  "pickupDate": "date",
  "status": "string"
}
```

## 🔄 Request/Response Examples

### Create Listing

```bash
curl -X POST https://paw-mart-server-side.vercel.app/listings \
  -H "Authorization: Bearer <TOKEN>" \
  -H "Content-Type: application/json" \
  -d '{
    "name": "Golden Retriever",
    "category": "Pets",
    "price": 0,
    "description": "Friendly and playful",
    "imageUrl": "https://example.com/image.jpg",
    "location": "Dhaka",
    "pickupDate": "2024-12-01",
    "email": "user@example.com",
    "userName": "John Doe",
    "userId": "user123"
  }'
```

### Get All Listings

```bash
curl https://paw-mart-server-side.vercel.app/listings
```

### Get Orders by Email

```bash
curl "https://paw-mart-server-side.vercel.app/orders?email=user@example.com" \
  -H "Authorization: Bearer <TOKEN>"
```

## ⚠️ Error Handling

The API returns standard HTTP status codes:

| Status | Meaning                              |
| ------ | ------------------------------------ |
| `200`  | OK - Request successful              |
| `201`  | Created - Resource created           |
| `400`  | Bad Request - Invalid input          |
| `401`  | Unauthorized - Missing/invalid token |
| `403`  | Forbidden - Access denied            |
| `404`  | Not Found - Resource not found       |
| `500`  | Internal Server Error                |

## 📝 License

This project is licensed under the MIT License.

## 👨‍💼 Author

**Sourav Sarkar**

- GitHub: [@sorkar5sourav](https://github.com/sorkar5sourav)

## 📞 Support

For issues or questions, please open an issue on GitHub or contact through the website.

---

**PawMart Backend - Powering pet adoption and care 🐾**
