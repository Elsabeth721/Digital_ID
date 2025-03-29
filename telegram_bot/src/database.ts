import { createClient } from "@supabase/supabase-js";
import { SUPABASE_URL, SUPABASE_KEY } from "./config";
import * as fs from 'fs';

export const supabase = createClient(SUPABASE_URL, SUPABASE_KEY, {
  auth: { persistSession: false, autoRefreshToken: false }
});

export async function testConnection() {
  const { error } = await supabase.from("users").select("*").limit(1);
  return !error;
}

export async function saveUserData(
  id: string,
  creatorId: string,
  isSelf: boolean,
  fullName: string,
  motherName: string,
  religiousName: string,
  confessionFatherName: string,
  age: number,
  phone: string,
  email: string,
  educationStatus: string,
  serviceClass: string,
  fieldOfStudy: string,
  currentWork: string,
  photoUrl: string,
  location: string,
  idCardUrl: string
) {
  try {
    const { data, error } = await supabase.from("users").insert([{
      id,
      creator_id: creatorId,
      is_self: isSelf,
      full_name: fullName,
      mother_name: motherName,
      religious_name: religiousName,
      confession_father_name: confessionFatherName,
      age,
      phone,
      email,
      education_status: educationStatus,
      service_class: serviceClass,
      field_of_study: fieldOfStudy,
      current_work: currentWork,
      photo_url: photoUrl,
      location,
      id_card_url: idCardUrl
    }]).select();

    if (error) throw error;
    return data;
  } catch (error) {
    console.error("Error saving user data:", error);
    throw error;
  }
}

export async function uploadToStorage(
  fileBuffer: Buffer,
  type: 'profile' | 'id-card',
  userId: string
): Promise<string> {
  const filename = `${type === 'profile' ? 'profiles' : 'ids'}/${type}_${userId}_${Date.now()}.${type === 'profile' ? 'jpg' : 'png'}`;

  const { data, error } = await supabase.storage
    .from('id-cards')
    .upload(filename, fileBuffer, {
      contentType: type === 'profile' ? 'image/jpeg' : 'image/png'
    });

  if (error) throw error;
  return supabase.storage.from('id-cards').getPublicUrl(data.path).data.publicUrl;
}

export async function cleanupUserFiles(userId: string) {
  await supabase.storage
    .from('id-cards')
    .remove([
      `profiles/profile_${userId}_*`,
      `ids/id-card_${userId}_*`
    ]);
}
export async function deleteUserFiles(userId: string) {
  const filesToDelete = [
    `profiles/profile_${userId}_*`,
    `ids/id_${userId}_*`
  ];

  await supabase.storage
    .from('id-cards')
    .remove(filesToDelete);
}