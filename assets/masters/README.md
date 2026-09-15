# Master assets

Originals, kept out of `public/` so they are version-controlled but never
served to the web.

## `fixter-animated-master.glb`

The Meshy export of the Profixter Fixter character: textured mesh, MeshyRig
skeleton (28 joints) and four clips (`Running`, `Walking`, `walking_2`,
`restpose`). 24,302,372 bytes, MD5 `2fbbea859872950253ce89dea3f9c83a`.

**Do not modify this file.** It is the source of truth. What the Lab actually
loads is `public/3d/fixter-animated.glb`, a web build of this master with the
textures resized (4096 -> 2048 colour/normal, 2048 -> 1024 metallic-roughness),
which takes it from 24.3 MB to 6.0 MB and from roughly 200 MB of GPU memory to
about 50 MB. Geometry, rig and clips are identical between the two.

To regenerate the web copy from this master:

    npx @gltf-transform/cli resize assets/masters/fixter-animated-master.glb tmp.glb \
      --width 2048 --height 2048 --pattern "{Image_0,Image_2}"
    npx @gltf-transform/cli resize tmp.glb public/3d/fixter-animated.glb \
      --width 1024 --height 1024 --pattern "Image_1"
