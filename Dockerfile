FROM node:18-alpine

WORKDIR /app

# nodemon Faqat agar test uchun kerak bo‘lsa
RUN npm install -g nodemon

COPY package*.json ./
RUN npm install

COPY . .

EXPOSE 3002

# Ishlab chiqish uchun nodemon, production uchun node
CMD ["node", "server.js"]
