import { NextResponse } from 'next/server';
import * as fs from 'fs';
import * as path from 'path';

export async function GET() {
  const stockFilePath = path.resolve(process.cwd(), 'stock-data.json');

  try {
    if (fs.existsSync(stockFilePath)) {
      const fileContents = fs.readFileSync(stockFilePath, 'utf-8');
      const data = JSON.parse(fileContents);
      return NextResponse.json(data);
    } else {
      // If the file doesn't exist yet, return an empty object with a timestamp.
      // The mobile app can then know that data is not yet available.
      return NextResponse.json({ 
        seeds: [],
        gear: [],
        lastUpdated: null 
      }, { status: 404 });
    }
  } catch (error) {
    console.error('Error reading stock data file:', error);
    return NextResponse.json({ error: 'Failed to read stock data.' }, { status: 500 });
  }
} 