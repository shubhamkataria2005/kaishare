/**
 * Fills the database with demo accounts, listings and claims.
 * Run with: npm run seed   (removes existing KaiShare data first)
 *
 * All demo accounts use the password KaiShare2026
 * The organisations below are fictional.
 */
import bcrypt from 'bcryptjs'
import mongoose from 'mongoose'
import { config } from '../src/config/env.js'
import { connectDatabase, disconnectDatabase } from '../src/config/database.js'
import { Claim } from '../src/models/Claim.js'
import { Listing } from '../src/models/Listing.js'
import { PushSubscription } from '../src/models/PushSubscription.js'
import { RefreshSession } from '../src/models/RefreshSession.js'
import { User } from '../src/models/User.js'

const HOUR = 60 * 60 * 1000
const at = (hoursFromNow) => new Date(Date.now() + hoursFromNow * HOUR)

async function seed() {
  await connectDatabase(config.mongoUri)
  await Promise.all([User, Listing, Claim, PushSubscription, RefreshSession].map((model) => model.deleteMany({})))
  // Make sure every index in the schemas exists (unique email, text search, TTL...).
  await Promise.all([User, Listing, Claim, PushSubscription, RefreshSession].map((model) => model.syncIndexes()))

  const passwordHash = await bcrypt.hash('KaiShare2026', config.bcryptRounds)
  const [admin, bakery, grocer, cafe, mission, volunteer] = await User.create([
    { name: 'Aroha Admin', email: 'admin@kaishare.nz', role: 'admin', passwordHash, organisation: 'KaiShare', suburb: 'Auckland CBD' },
    { name: 'Mere Thompson', email: 'mere@ponsonbybakehouse.nz', role: 'donor', passwordHash, organisation: 'Ponsonby Bakehouse', suburb: 'Ponsonby', phone: '021 555 0101' },
    { name: 'Raj Patel', email: 'raj@greylynnproduce.nz', role: 'donor', passwordHash, organisation: 'Grey Lynn Produce Co.', suburb: 'Grey Lynn', phone: '022 555 0102' },
    { name: 'Sofia Lee', email: 'sofia@karangahapecafe.nz', role: 'donor', passwordHash, organisation: 'K Road Kitchen', suburb: 'Newton' },
    { name: 'Tama Wiremu', email: 'tama@kaicollective.org.nz', role: 'rescuer', passwordHash, organisation: 'Kai Collective Trust', suburb: 'Mt Eden', phone: '027 555 0103' },
    { name: 'Emily Chen', email: 'emily.volunteer@example.com', role: 'rescuer', passwordHash, organisation: 'Community Pantry Volunteers', suburb: 'Kingsland' },
  ])

  const listings = await Listing.create([
    { donor: bakery._id, title: 'Sourdough loaves', description: 'Today\'s unsold sourdough and rye, baked this morning.', category: 'bakery', quantity: 18, unit: 'loaves', dietaryTags: ['vegan', 'dairy-free'], pickupStart: at(1), pickupEnd: at(5), address: '112 Ponsonby Road', suburb: 'Ponsonby' },
    { donor: bakery._id, title: 'Assorted muffins and scones', description: 'Blueberry muffins and cheese scones.', category: 'bakery', quantity: 30, unit: 'items', dietaryTags: ['vegetarian'], pickupStart: at(2), pickupEnd: at(6), address: '112 Ponsonby Road', suburb: 'Ponsonby' },
    { donor: grocer._id, title: 'Mixed seasonal vegetables', description: 'Carrots, kūmara, silverbeet and capsicums. Slightly blemished, perfectly good.', category: 'produce', quantity: 12, unit: 'kg', dietaryTags: ['vegan', 'gluten-free'], pickupStart: at(0.5), pickupEnd: at(26), address: '45 Great North Road', suburb: 'Grey Lynn' },
    { donor: grocer._id, title: 'Apples and feijoas', category: 'produce', quantity: 4, unit: 'boxes', dietaryTags: ['vegan', 'gluten-free', 'nut-free'], pickupStart: at(3), pickupEnd: at(30), address: '45 Great North Road', suburb: 'Grey Lynn' },
    { donor: cafe._id, title: 'Vegetable curry with rice', description: 'Cooked at lunch, chilled at 3pm. Bring chilly bins.', category: 'prepared-meals', quantity: 25, unit: 'portions', dietaryTags: ['vegetarian', 'halal', 'nut-free'], pickupStart: at(1), pickupEnd: at(4), address: '201 Karangahape Road', suburb: 'Newton' },
    { donor: cafe._id, title: 'Milk and yoghurt (best before tomorrow)', category: 'dairy', quantity: 10, unit: 'items', dietaryTags: ['vegetarian', 'gluten-free'], pickupStart: at(1), pickupEnd: at(20), address: '201 Karangahape Road', suburb: 'Newton', status: 'reserved' },
    { donor: bakery._id, title: 'Croissants (yesterday)', category: 'bakery', quantity: 24, unit: 'items', dietaryTags: ['vegetarian'], pickupStart: at(-26), pickupEnd: at(-22), address: '112 Ponsonby Road', suburb: 'Ponsonby', status: 'collected' },
  ])

  await Claim.create([
    { listing: listings[5]._id, rescuer: mission._id, donor: cafe._id, pickupTime: at(2), note: 'Van arrives around 2 hours from now.', status: 'confirmed' },
    { listing: listings[6]._id, rescuer: volunteer._id, donor: bakery._id, pickupTime: at(-23), note: 'For the Kingsland community pantry.', status: 'collected' },
  ])

  console.log(`Seeded ${await User.countDocuments()} users, ${await Listing.countDocuments()} listings, ${await Claim.countDocuments()} claims.`)
  console.log('Demo password for every account: KaiShare2026')
  console.log(`  admin ${admin.email} | donor ${bakery.email} | rescuer ${mission.email}`)
}

seed()
  .catch((error) => {
    console.error('Seeding failed:', error.message)
    process.exitCode = 1
  })
  .finally(async () => {
    if (mongoose.connection.readyState) await disconnectDatabase()
  })
