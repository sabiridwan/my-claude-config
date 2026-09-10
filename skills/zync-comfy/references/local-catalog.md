# What this machine can actually run — local template catalog

Snapshot of `search_templates(exclude_api=True)` on 2026-09-11: **282 free/local**
templates in `comfyui-workflow-templates` 0.11.59. This is ground truth for
"is there already a working graph for X" — always check here before hand-building a
workflow. Re-snapshot with `search_templates`; the gallery is cached 24h and moves fast.

Template name -> `fetch_template(name, out_path)`. The catalog is **independent of what
is installed**, so a row existing says nothing about whether its models are on disk —
`local_check` in the fetch result is the only answer to that.


## Image (104 of the free set)

| template name | what it does |
|---|---|
| `Image_capybara_v0_1_image_edit` | **Capybara: Image Edit** — Upload an image or video and input a text instruction. Generate an edited output using t… |
| `Image_capybara_v0_1_text_to_image` | **Capybara: Text to Image** — Input a text prompt to generate an image. This workflow uses the Capybara unified model… |
| `flux1_dev_uso_reference_image_gen` | **Flux.1 Dev USO Reference Image Generation** — Use reference images to control both style and subject - keep your character's face whil… |
| `flux1_krea_dev` | **Flux.1 Krea Dev** — A fine-tuned FLUX model pushing photorealism to the max |
| `flux_canny_model_example` | **Flux.1 Canny Model** — Generate images guided by edge detection using Flux.1 Canny. |
| `flux_depth_lora_example` | **Flux.1 Depth Lora** — Generate images guided by depth information using Flux.1 LoRA. |
| `flux_dev_checkpoint_example` | **Flux.1 Dev fp8: Text to Image** — Generate images using Flux.1 Dev fp8 quantized version. Suitable for devices with limite… |
| `flux_dev_full_text_to_image` | **Flux.1 Dev: Text to Image** — Generate high-quality images with Flux Dev full version. Requires larger VRAM and multip… |
| `flux_fill_inpaint_example` | **Flux.1 Inpaint** — Fill missing parts of images using Flux.1 Fill Inpainting. |
| `flux_fill_outpaint_example` | **Flux.1 Outpaint** — Extend images beyond boundaries using Flux.1 outpainting. |
| `flux_kontext_dev_basic` | **Flux Kontext Dev Image Edit** — Smart image editing that keeps characters consistent, edits specific parts without affec… |
| `flux_redux_model_example` | **Flux.1 Redux Model** — Generate images by transferring style from reference images using Flux.1 Redux. |
| `flux_schnell` | **Flux.1 Schnell FP8** — Quickly generate images with Flux.1 Schnell fp8 quantized version. Ideal for low-end har… |
| `flux_schnell_full_text_to_image` | **Flux.1 Schnell Full: Text to Image** — Generate images quickly with Flux.1 Schnell full version. Uses Apache2.0 license, requir… |
| `hidream_e1_1` | **HiDream E1.1 Image Editing** — Edit images with HiDream E1.1—superior image quality and editing accuracy compared to Hi… |
| `hidream_e1_full` | **HiDream E1 Image Edit** — Edit images with HiDream E1 - Professional natural language image editing model. |
| `hidream_i1_dev` | **HiDream I1 Dev** — Generate images with HiDream I1 Dev - Balanced version with 28 inference steps, suitable… |
| `hidream_i1_fast` | **HiDream I1 Fast** — Generate images quickly with HiDream I1 Fast - Lightweight version with 16 inference ste… |
| `hidream_i1_full` | **HiDream I1 Full** — Generate images with HiDream I1 Full - Complete version with 50 inference steps for high… |
| `image-qwen_image_edit_2511_lora_inflation` | **Image Inflation Effect with INFL8 LoRA** — Upload an image and specify a subject. Generate an inflated version of that subject usin… |
| `image_anima_base_v1` | **Anima Base v1: Text to Image** — Input a text prompt describing an anime or artistic illustration. Generate a non-photore… |
| `image_anima_lllite_any_control_to_image` | **Anima Lllite: Any Control to Image** — Apply lightweight, LoRA-like conditional control to Anima-Base v1.0 anime-style images u… |
| `image_anima_lllite_depth_control_to_image` | **Anima Lllite: Depth Control to Image** — Generate anime-style illustrations from a depth map using the Anima LLLite model, which… |
| `image_anima_lllite_image_inpainting` | **Anima Lllite: Image Inpainting** — Inpaint anime images with Anima LLLite, a lightweight ControlNet variant that applies lo… |
| `image_anima_preview` | **Anima Anime Text-to-Image Generation** — Input a text prompt to generate an anime-style image using the Anima model. Configure se… |
| `image_boogu_image_0_1_edit` | **Boogu image 0.1 Edit** — Edit images using Boogu's instruction-driven model, taking one input image and generatin… |
| `image_boogu_image_0_1_edit_int8` | **Boogu image 0.1 Edit Int8** — Edit images with the Boogu Image Edit model, now optimized with convrot int8 quantizatio… |
| `image_boogu_image_0_1_turbo_t2i` | **Boogu Turbo: Text to Image** — Generate high-quality images from text prompts using the Boogu Turbo model, a distilled… |
| `image_chroma1_radiance_text_to_image` | **Chroma1 Radiance Text to Image** — Chroma1-Radiance works directly with image pixels instead of compressed latents, deliver… |
| `image_chroma_text_to_image` | **Chroma: Text to Image** — Chroma - enhanced Flux model with improved image quality and better prompt understanding… |
| `image_chrono_edit_14B` | **ChronoEdit 14B: Image Edit** — Image editing powered by video models' dynamic understanding, creating physically plausi… |
| `image_ernie_image` | **Ernie Image: Text to Image** — Generate images from text prompts using the ERNIE-Image model. Input a text description… |
| `image_ernie_image_turbo` | **Ernie Image Turbo: Text To Image** — Generate images from text prompts using the ERNIE-Image turbo model. Input a text descri… |
| `image_firered_image_edit1_1` | **FireRed Image Edit 1.1: Image Edit** — Upload an image and a text prompt to edit it. Generate a modified image with enhanced id… |
| `image_flux.1_fill_dev_OneReward` | **Flux.1 Dev OneReward** — Supports various tasks such as image inpainting, outpainting, and object removal by byte… |
| `image_flux2` | **Flux.2 Dev** — Generate photorealistic images with multi-reference consistency and professional text re… |
| `image_flux2_fp8` | **Product Mockup(Flux.2 Dev FP8)** — Create product mockups by applying design patterns to packaging, mugs, and other product… |
| `image_flux2_klein_9b_kv_image_edit` | **Flux.2 Klein KV: Image Edit** — Upload reference images and a text prompt. Generate multiple edited images using cached… |
| `image_flux2_klein_image_edit_4b_base` | **Flux.2 [Klein] 4B: Image Edit** — A smaller foundation model with exceptional quality-to-size ratio. Ideal for local deplo… |
| `image_flux2_klein_image_edit_4b_distilled` | **Flux.2 [Klein] 4B Distilled: Image Edit** — The fastest variant in the Klein family. Built for interactive applications, real-time p… |
| `image_flux2_klein_image_edit_9b_base` | **Flux.2 [Klein] 9B: Image Edit** — BFL undistilled foundation model. Maximum flexibility and control. Great for fine-tuning. |
| `image_flux2_klein_image_edit_9b_distilled` | **Flux.2 [Klein] 9B Distilled: Image Edit** — BFL distilled model. Outstanding quality at sub-second speed. Great for real-time genera… |
| `image_flux2_klein_text_to_image` | **Flux.2 [Klein] 4B: Text to Image** — BFL distilled model. Outstanding quality at sub-second speed. Great for real-time genera… |
| `image_flux2_text_to_image` | **Flux.2 Dev Text to Image** — Text-to-image with enhanced lighting, materials, and realistic details. |
| `image_flux2_text_to_image_9b` | **Flux.2 [Klein] 9B: Text to Image** — BFL distilled model. Outstanding quality at sub-second speed. Great for real-time genera… |
| `image_hidream_o1` | **HiDream O1 Full: Image generation** — Input a text prompt and optionally upload reference images. Generate a high-resolution i… |
| `image_hidream_o1_dev` | **HiDream O1 Dev** — Input a text prompt and optional reference images. Generate a high-resolution image (up… |
| `image_ideogram4_t2i` | **Ideogram v4: Text to Image** — Input a text prompt or structured JSON description. Generate an image with precise layou… |
| `image_ideogram4_t2i_int8` | **Ideogram v4 Int8: Text to Image** — Generate images from text prompts using the Ideogram v4 model, a state-of-the-art open-w… |
| `image_joyai_image_edit` | **JoyAI Image Edit** — Edit images by following natural language instructions with JoyAI-Image-Edit, which leve… |
| `image_kandinsky5_t2i` | **Kandinsky 5.0 Image Lite: Text to Image** — A lightweight 2B model that generates images from English and Russian prompts with high… |
| `image_krea2_turbo_int8_image_style_reference` | **Krea-2 Int8: Image Style Reference** — Generate images with the Krea-2 Turbo model while referencing the style of 1–2 uploaded… |
| `image_krea2_turbo_t2i` | **Krea-2: Text to Image** — Generate images from text prompts using Krea 2, a foundation model built for aesthetic q… |
| `image_krea2_turbo_t2i_int8` | **Krea-2 Int8: Text to Image** — Generate images with the Krea-2 Turbo distilled text-to-image model using the high-perfo… |
| `image_lens_t2i` | **Lens: Text to Image** — Input a text prompt and select resolution and aspect ratio. Generate a high-quality imag… |
| `image_lens_turbo_t2i` | **Lens Turbo: Text to Image** — Input a text prompt and select resolution, aspect ratio, and inference steps. Generate a… |
| `image_longcat_image_edit` | **LongCat Image Edit** — Edit images using the LongCat-Image-Edit model. Supports bilingual instructions for glob… |
| `image_longcat_text_to_image` | **LongCat Image: Text to Image** — Generate an image from a text prompt. Input your desired scene description in English or… |
| `image_mage_flow_edit_int8` | **Mage-Flow-Edit: Image Edit** — Edit images by following natural language instructions with Mage-Flow-Edit, an instructi… |
| `image_mage_flow_edit_turbo_int8` | **Mage-Flow-Edit Turbo: Image Edit** — Edit images using a reference photo and text instructions with the Mage-Flow-Edit Turbo… |
| `image_mage_flow_t2i_int8` | **Mage-Flow: Text to Image** — Generate high-resolution images from text prompts using Mage-Flow, a compact 4B-paramete… |
| `image_mage_flow_turbo_t2i_int8` | **Mage-Flow Turbo: Text to Image** — Generate high-quality images from text prompts using the compact 4B-parameter Mage-Flow… |
| `image_netayume_lumina_t2i` | **NetaYume Lumina Text to Image** — High-quality anime-style image generation with enhanced character understanding and deta… |
| `image_newbieimage_exp0_1-t2i` | **NewBie Exp0.1: Anime Generation** — Generate detailed anime-style images with NewBie Exp0.1's Next-DiT architecture. Support… |
| `image_omnigen2_image_edit` | **OmniGen2 Image Edit** — Edit images with natural language instructions using OmniGen2's advanced image editing c… |
| `image_omnigen2_t2i` | **OmniGen2: Text to Image** — Generate high-quality images from text prompts using OmniGen2's unified 7B multimodal mo… |
| `image_ovis_text_to_image` | **Ovis-Image Text to Image** — Ovis-Image is a 7B text-to-image model specifically optimized for high-quality text rend… |
| `image_pixeldit_t2i` | **PixelDiT: Text to Image** — Input a text prompt and optional negative prompt. Generate a 1024px image using PixelDiT… |
| `image_qwen_Image_2512` | **Qwen Image 2512** — Text-to-image model with enhanced human realism, finer natural details for landscapes an… |
| `image_qwen_Image_2512_controlnet` | **Qwen-Image 2512: Fun Union ControlNet** — Upload an image and select a control type from Canny, HED, Depth, Pose, MLSD, Scribble,… |
| `image_qwen_image` | **Qwen-Image: Text to Image** — Generate images with exceptional multilingual text rendering and editing capabilities us… |
| `image_qwen_image_2512_with_2steps_lora` | **Qwen-Image 2512 Turbo** — Qwen-Image 2512 Image generation with 2-steps Turbo LoRA. Input your text prompt to quic… |
| `image_qwen_image_controlnet_patch` | **Qwen-Image ControlNet Model Patch** — Control image generation using Qwen-Image ControlNet models. Supports canny, depth, and… |
| `image_qwen_image_edit` | **Qwen Image Edit** — Edit images with precise bilingual text editing and dual semantic/appearance editing cap… |
| `image_qwen_image_edit_2509` | **Qwen Image Edit 2509** — Advanced image editing with multi-image support, improved consistency, and ControlNet in… |
| `image_qwen_image_edit_2509_relight` | **Image Relight** — Relight images using Qwen-Image-Edit with LoRA support. |
| `image_qwen_image_edit_2511` | **Qwen Image Edit 2511 - Material Replacement** — Replace materials in objects (e.g., furniture) by combining reference images with Qwen-I… |
| `image_qwen_image_edit_2511_int8` | **Qwen Image Edit 2511 Int8: Image Edit** — Edit images with Qwen Image Edit 2511 Int8, using a quantized model for faster inference… |
| `image_qwen_image_instantx_controlnet` | **Qwen-Image InstantX Union ControlNet** — Generate images with Qwen-Image InstantX ControlNet, supporting canny, soft edge, depth,… |
| `image_qwen_image_instantx_inpainting_controlnet` | **Qwen-Image InstantX Inpainting ControlNet** — Professional inpainting and image editing with Qwen-Image InstantX ControlNet. Supports… |
| `image_qwen_image_union_control_lora` | **Qwen-Image Union Control** — Generate images with precise structural control using Qwen-Image's unified ControlNet Lo… |
| `image_sdxl_simple` | **SDXL1.0: Text to Image (Simple)** — Generate high-quality images from text prompts using the SDXL 1.0 model, offering a stra… |
| `image_z_image` | **Z-Image: Text to Image** — Foundation for creative freedom. Diverse aesthetics with exceptional photorealistic qual… |
| `image_z_image_int8` | **Z-Image Int8: Text to Image** — Generate high-quality, diverse images from text prompts using the Z-Image Int8 model, wh… |
| `image_z_image_turbo` | **Z-Image-Turbo: Text to Image** — An Efficient Image Generation Foundation Model with Single-Stream Diffusion Transformer,… |
| `image_z_image_turbo_fun_union_controlnet` | **Z-Image-Turbo Fun Union ControlNet** — Multi-control ControlNet supporting Canny, HED, Depth, Pose, and MLSD for Z-Image-Turbo. |
| `image_z_image_turbo_int8` | **Z-Image-Turbo Int8: Text to Image** — Generate photorealistic images using the Z-Image-Turbo int8 model, a distilled 6B-parame… |
| `sd3.5_large_blur` | **SD3.5 Large Blur** — Generate images guided by blurred reference images using SD 3.5. |
| `sd3.5_large_canny_controlnet_example` | **SD3.5 Large Canny ControlNet** — Generate images guided by edge detection using SD 3.5 Canny ControlNet. |
| `sd3.5_large_depth` | **SD3.5 Large Depth** — Generate images guided by depth information using SD 3.5. |
| `sd3.5_simple_example` | **SD3.5 Simple** — Generate images using SD 3.5. |
| `sdxl_refiner_prompt_example` | **SDXL Refiner Prompt** — Enhance SDXL images using refiner models. |
| `sdxl_revision_text_prompts` | **SDXL Revision Text Prompts** — Generate images by transferring concepts from reference images using SDXL Revision. |
| `sdxl_simple_example` | **SDXL Simple** — Generate high-quality images using SDXL. |
| `sdxlturbo_example` | **SDXL Turbo** — Generate images in a single step using SDXL Turbo. |
| `template_qwen_Image_2512_360_lora` | **Qwen Image 2512: 360 Panorama Image** — Generate 360-degree equirectangular projection images from text descriptions using a ran… |
| `template_qwen_image_edit_2511_systms_action` | **Qwen Image Edit 2511: SYSTMS ACTION LoRA** — Upload your target image and use the trigger phrase "action the [thing]" (e.g., "action… |
| `template_qwen_image_illustration_lora` | **Qwen Image: Illustration LoRA** — A t2v workflows for a style LoRA built on Qwen-Image. Produces images spanning cute anim… |
| `template_sugar_coated_gummy_style_qwen` | **Qwen Image: Gummy Animals LoRA** — Apply a Qwen Image LoRA to transform any subject into a sour gummy candy-style character… |
| `templates-image_to_real` | **Illustration to Realism** — Input an illustration and generate a hyper realistic version using Qwen Image Edit 2509. |
| `templates_purz_image_glitch` | **Apply Glitch And Distortion Effects** — Adds customizable glitch and tearing effects to images. Control distortion intensity, ch… |
| `templates_purz_pixel_sort_image` | **Pixel Sort Glitch Effect Image Transformation** — Apply a pixel sorting algorithm to create glitch art. Control the effect direction, thre… |
| `templates_rob_image_to_real.app` | **Illustration to Realism** — Input an illustration and generate a realistic version using Qwen Image Edit 2509 with A… |
| `video_bernini_r_image_editing` | **Bernini-R: Image Edit** — Generate an edited image with matched lighting and view a side-by-side before/after comp… |

## Image Tools (19 of the free set)

| template name | what it does |
|---|---|
| `image_lotus_depth_v1_1` | **Depth Estimation: Lotus** — Run Lotus Depth in ComfyUI for zero-shot, efficient monocular depth estimation with high… |
| `image_qwen_image_layered` | **Layer Decomposition: Qwen-Image-Layered** — Decompose an image into editable RGBA layers for high-fidelity recolor, replace, resize,… |
| `image_qwen_image_layered_control` | **Layer Decomposition: Qwen-Image-Layered Control** — Describe the elements you want in the image and decompose it precisely from the image. |
| `templates_doc_workbox_klein_9b_image_extend` | **Image Outpainting: Flux.2 Klein 9B** — Use the FLUX.2 Klein 9B model to intelligently extend and expand image content. Input an… |
| `templates_hellorob_facegen_skindetail_upscale` | **Skin Enhancer + Upscaler** — One click workflow to generate a character portrait, refine/add skin details, and upscal… |
| `utility_birefnet_remove_background` | **Remove Background: BiRefNet** — Upload an image with any background. Generate a version with the background removed and… |
| `utility_depth_anything3_image_depth_estimation` | **Depth Estimation: Depth Anything 3** — Upload 1 image. Generate a depth map using Depth Anything 3 and view a side-by-side comp… |
| `utility_face_detection_mediapipe` | **Face Detection: MediaPipe** — Input an image and detect up to 6 facial landmarks per face, enabling ultrafast multi-fa… |
| `utility_image_segment_sam3` | **Image Segmentation: SAM3** — Use the SAM3 model to segment the main subject or content from a photo or image, isolati… |
| `utility_image_upscale_supir` | **Image Restoration: SUPIR** — Restore and enhance images using SUPIR's generative prior and text guidance. Accepts ima… |
| `utility_interpolation_image_upscale` | **Image Upscale: Traditional Interpolation** — Upload an image and select an interpolation method. Upscale the image using traditional… |
| `utility_moge_depth_estimation` | **Depth Estimation: MoGe** — Upload a single RGB image and adjust inference resolution and batch size. Generate a col… |
| `utility_pid_latent_upscale_dit` | **Image Upscale: PiD Latent Decode** — Input a latent image from a diffusion model and select a PiD checkpoint. Generate a high… |
| `utility_sdpose_multi_person` | **Pose Detection: SDPose Multi-Person** — Upload an image to detect human poses. Supports detection for both single individuals an… |
| `utility_sdpose_ood_image_to_pose` | **Pose Map: SDPose-OOD** — Upload an image to extract pose keypoints and generate a corresponding pose map using th… |
| `utility_seedvr2_3b_int8_upscale_image` | **Image Upscale: SeedVR2 3B Int8** — Upscale images using SeedVR2 3B Int8, a one-step diffusion-based video restoration model… |
| `utility_seedvr2_7b_int8_upscale_image` | **Image Upscale: SeedVR2 7B Int8** — Upscale images using SeedVR2 7B Int8, a one-step diffusion model that enhances resolutio… |
| `utility_seedvr2_image_upscale` | **Image Upscale: SeedVR2** — Upload an image to upscale it with SeedVR2 and generate a high-definition output. |
| `utility_z_image_turbo_2k_upscaler.app` | **Image Upscale: Z-Image-Turbo 2K** — Upload an image to upscale it to 2K resolution using the Z-Image-Turbo model. |

## Video (77 of the free set)

| template name | what it does |
|---|---|
| `hunyuan_video_text_to_video` | **Hunyuan Video Text to Video** — Generate videos from text prompts using Hunyuan model. |
| `image_to_video_wan` | **Wan 2.1 Image to Video** — Generate videos from images using Wan 2.1. |
| `ltxv_image_to_video` | **LTXV Image to Video** — Generate videos from still images. |
| `ltxv_text_to_video` | **LTXV Text to Video** — Generate videos from text prompts. |
| `template_animate_diff_loops` | **Animate Diff High Res Loops** — upload one image to get a seamless loop animation |
| `template_ltx2_3_lora_googly_eyes` | **Googly Eyes** — LTX 2.3 LoRA that makes anyone in the input video have Googly Eyes. This workflow utiliz… |
| `template_ltx2_3_style_transition` | **LTX-2.3 Style Transition** — Apply the ltx2.3-transition LoRA to create smooth style and scene transitions. This work… |
| `templates_ingi_infl8` | **Inflation Lora Character Expansion Effect Video** — Upload a character image and input your prompt. Generate an animated video where the cha… |
| `templates_rob_wan_ati_motion_control` | **Wan ATI Motion Control** — Upload an input image and use the Animate Path node to draw paths for a viral video effe… |
| `text_to_video_wan` | **Wan 2.1 Text to Video** — Generate videos from text prompts using Wan 2.1. |
| `txt_to_image_to_video` | **SVD Text to Image to Video** — Generate videos by first creating images from text prompts. |
| `video-wan21_scail` | **Wan2.1 SCAIL** — One-Touch SCAIL Pose Control based on the composition of the Reference Image |
| `video_bernini_r_video_editing` | **Bernini-R: Video Edit** — Generate an edited video with consistent relighting using Bernini-R. Ideal for portrait… |
| `video_capybara_v0_1_image_to_video` | **Capybara: Image to Video** — Upload an image and provide a text instruction. Generate a new video where the input is… |
| `video_capybara_v0_1_video_edit` | **Capybara: Video Edit** — Upload an image or video and a text instruction to perform generation or editing tasks.… |
| `video_causal_forcing_i2v` | **Causal Forcing: Image to Video** — Input a text prompt and select a model checkpoint. Generate a high-quality video using C… |
| `video_humo` | **HuMo Video Generation** — Generate videos basic on audio, image, and text, keep the character's lip sync. |
| `video_hunyuan_video_1.5_720p_i2v` | **Hunyuan Video 1.5 Image to Video** — Animate still images into dynamic videos with precise motion and camera control. Maintai… |
| `video_hunyuan_video_1.5_720p_t2v` | **Hunyuan Video 1.5 Text to Video** — Generate high-quality 720p videos from text prompts with cinematic camera control, emoti… |
| `video_kandinsky5_i2v` | **Kandinsky 5.0 Video Lite Image to Video** — A lightweight 2B model that generates videos from English and Russian prompts with high… |
| `video_kandinsky5_t2v` | **Kandinsky 5.0 Video Lite Text to Video** — A lightweight 2B model that generates videos from English and Russian prompts with high… |
| `video_ltx2_3_flf2v` | **LTX-2.3: FLF2V** — Upload a starting image to generate a video sequence. The workflow creates a short video… |
| `video_ltx2_3_i2v` | **LTX-2.3: Image to Video** — Upload an image to generate a video with improved motion consistency and fine details, i… |
| `video_ltx2_3_ia2v` | **LTX-2.3: Image Audio to Video** — Upload an image and an audio file to generate a high-quality video with synchronized lip… |
| `video_ltx2_3_ic_lora` | **LTX 2.3 IC-LoRA Union Control** — Generate LTX 2.3 videos with IC-LoRA using aligned control inputs like depth, pose, or e… |
| `video_ltx2_3_id_lora` | **LTX-2.3: ID LoRA** — Generate personalized videos with synchronized audio from a text prompt, reference image… |
| `video_ltx2_3_t2v` | **LTX-2.3: Text to Video** — Generate a video from a text prompt, optionally using an image for reference. Receive a… |
| `video_ltx2_5_flf2v` | **LTX-2.5: FLF2V** — Generate a video from first and last frame reference images using LTX-2.5, blending both… |
| `video_ltx2_5_i2v` | **LTX-2.5: Image to Video** — Generate video from a single image using LTX-2.5, producing a high-fidelity clip with in… |
| `video_ltx2_5_t2v` | **LTX-2.5: Text to Video** — Generate cinematic video from a text prompt using LTX-2.5, a production-ready diffusion… |
| `video_ltx2_canny_to_video` | **LTX-2 Canny to Video** — Generate high-quality videos from edge detection (Canny) guidance with synchronized audi… |
| `video_ltx2_depth_to_video` | **LTX-2 Depth to Video** — Generate high-quality videos from depth maps with synchronized audio-video generation us… |
| `video_ltx2_i2v` | **LTX-2: Image to Video** — Transform static images into dynamic videos with synchronized audio-video generation usi… |
| `video_ltx2_i2v_distilled` | **LTX-2 Image to Video (Distilled)** — Transform static images into dynamic videos with synchronized audio-video generation usi… |
| `video_ltx2_i2v_lora` | **Squish Anything with LTX-2 I2V and LoRA** — Upload any image to apply the Squish It LoRA effect. Generate a squished animation using… |
| `video_ltx2_pose_to_video` | **LTX-2 Pose to Video** — Generate high-quality videos from pose guidance with synchronized audio-video generation… |
| `video_ltx2_t2v` | **LTX-2 Text to Video** — Generate high-quality videos from text prompts with synchronized audio-video generation… |
| `video_ltx2_t2v_distilled` | **LTX-2 Text to Video (Distilled)** — Generate high-quality videos from text prompts with synchronized audio-video generation… |
| `video_ltx_2_audio_to_video` | **LTX-2: Audio to Video** — Upload an audio file and a starting image frame. Generate a video synchronized to the au… |
| `video_minimax_h3_fun_controlnet_union` | **MiniMax H3 Fun ControlNet Union** — Generate videos from a pose reference video using MiniMax-H3 with a ControlNet-Union che… |
| `video_minimax_h3_i2v` | **MiniMax H3: Image to Video** — Turn a starting image into a short, high-quality video clip with MiniMax H3, a unified m… |
| `video_minimax_h3_i2v_continuation` | **Image to Video** — Start with an image and an empty prompt, then describe the motion, shots, and audio you… |
| `video_minimax_h3_multiframe_reference` | **MiniMax H3: Multiframe Reference** — Generate video from multiple still images with MiniMax H3, anchoring up to four referenc… |
| `video_minimax_h3_r2v` | **MiniMax H3: Reference to Video** — Generate a new video by feeding MiniMax H3 a reference image, up to nine images, three v… |
| `video_minimax_h3_t2v` | **MiniMax H3: Text to Video** — Generate video with native stereo audio directly from a text prompt using MiniMax H3, an… |
| `video_wan2.1_alpha_t2v_14B` | **Wan2.1 Alpha T2V** — Generate text-to-video with alpha channel support for transparent backgrounds and semi-t… |
| `video_wan2.1_fun_camera_v1.1_1.3B` | **Wan 2.1 Fun Camera 1.3B** — Generate dynamic videos with cinematic camera movements using Wan 2.1 Fun Camera 1.3B mo… |
| `video_wan2.1_fun_camera_v1.1_14B` | **Wan 2.1 Fun Camera 14B** — Generate high-quality videos with advanced camera control using the full 14B model |
| `video_wan21_scail2_character_replacement` | **SCAIL-2: Character Replacement** — Upload 1 reference character image and 1 driving video. Generate an animated video of th… |
| `video_wan21_scail2_character_replacement_int8` | **SCAIL-2 Int8: Character Replacement** — Animate a reference character using a driving video or replace characters entirely with… |
| `video_wan2_1_infinitetalk` | **InfiniteTalk: Audio-Driven Full-Body Video Dubbing** — Upload a source Image and target audio. Generate a full-body dubbed video with synchroni… |
| `video_wan2_2_14B_animate` | **Wan2.2 Animate, Character Animation and Replacement** — Unified character animation and replacement framework with precise motion and expression… |
| `video_wan2_2_14B_flf2v` | **Wan 2.2 14B First-Last Frame to Video** — Generate smooth video transitions by defining start and end frames. |
| `video_wan2_2_14B_fun_camera` | **Wan 2.2 14B Fun Camera Control** — Generate videos with camera motion controls including pan, zoom, and rotation using Wan… |
| `video_wan2_2_14B_fun_control` | **Wan 2.2 14B Fun Control** — Generate videos guided by pose, depth, and edge controls using Wan 2.2 Fun Control. |
| `video_wan2_2_14B_fun_inpaint` | **Wan 2.2 14B Fun Inp** — Generate videos from start and end frames using Wan 2.2 Fun Inp. |
| `video_wan2_2_14B_i2v` | **Wan 2.2 14B Image to Video** — Transform static images into dynamic videos with precise motion control and style preser… |
| `video_wan2_2_14B_s2v` | **Wan2.2-S2V Audio-Driven Video Generation** — Transform static images and audio into dynamic videos with perfect synchronization and m… |
| `video_wan2_2_14B_t2v` | **Wan 2.2 14B Text to Video** — Generate high-quality videos from text prompts with cinematic aesthetic control and dyna… |
| `video_wan2_2_5B_fun_control` | **Wan 2.2 5B Fun Control** — Multi-condition video control with pose, depth, and edge guidance. Compact 5B size for e… |
| `video_wan2_2_5B_fun_inpaint` | **Wan 2.2 5B Fun Inpaint** — Efficient video inpainting from start and end frames. 5B model delivers quick iterations… |
| `video_wan2_2_5B_ti2v` | **Wan 2.2 5B Video Generation** — Fast text-to-video and image-to-video generation with 5B parameters. Optimized for rapid… |
| `video_wan_animate2` | **Wan Animate 2: Motion Transfer** — Animate a still character using a driving video with Wan Animate 2, transferring motion… |
| `video_wan_animate2_distilled` | **Wan Animate 2 Distilled: Motion Transfer** — Animate a still character using a driving video with Wan Animate 2, transferring motion… |
| `video_wan_ati` | **Wan2.1 ATI** — Trajectory-controlled Video Generation. |
| `video_wan_dancer` | **Wan Dancer: Music to Dance** — Generate minute-scale coherent dance videos from music using a hierarchical Wan Dancer f… |
| `video_wan_vace_14B_ref2v` | **Wan2.1 VACE Reference to Video** — Create videos that match the style and content of a reference image. Perfect for style-c… |
| `video_wan_vace_14B_t2v` | **Wan2.1 VACE Text to Video** — Transform text descriptions into high-quality videos. Supports both 480p and 720p with V… |
| `video_wan_vace_14B_v2v` | **Wan2.1 VACE Control Video** — Generate videos by controlling input videos and reference images using Wan VACE. |
| `video_wan_vace_flf2v` | **Wan2.1 VACE First-Last Frame** — Generate smooth video transitions by defining start and end frames. Supports custom keyf… |
| `video_wan_vace_inpainting` | **Wan2.1 VACE Inpainting** — Edit specific regions in videos while preserving surrounding content. Great for object r… |
| `video_wan_vace_outpainting` | **Wan2.1 VACE Outpainting** — Generate extended videos by expanding video size using Wan VACE outpainting. |
| `video_wanmove_480p` | **Wan-Move Motion-Control Image to Video** — Generate videos from a single image using Wan-Move, with fine-grained point-level motion… |
| `video_wanmove_480p_hallucination` | **WanMove: Daydream Illusion** — Use WanMove to generate dynamic images from trajectories and create video dynamic effect… |
| `wan2.1_flf2v_720_f16` | **Wan 2.1 FLF2V 720p F16** — Generate videos by controlling first and last frames using Wan 2.1 FLF2V. |
| `wan2.1_fun_control` | **Wan 2.1 ControlNet** — Generate videos guided by pose, depth, and edge controls using Wan 2.1 ControlNet. |
| `wan2.1_fun_inp` | **Wan 2.1 Inpainting** — Generate videos from start and end frames using Wan 2.1 inpainting. |

## Paid rows hide in the free list

`exclude_api=True` filters on the gallery's own `API` tag, not on graph inspection.
Rows named `api_seedance2_5_video_extend` and `api_google_gemini_omni_flash_1_1_extend`
came back `api: false` in this very snapshot. Any template naming a hosted provider —
Seedance, Gemini, MiniMax, Ideogram, Veo, Kling, Runway — gets confirmed with the user
before it runs, regardless of what the tag says.

## Free/paid sibling pairs

Several models ship twice: a local OSS graph and a hosted API graph with near-identical
titles. `video_minimax_h3_t2v` (local) vs `api_minimax_h3_t2v` (spends credits) is the
canonical example. Read `name`, `tags` and `api` — never the title.

## Snapshot provenance

- comfy-cli 1.20.0, `comfyui-workflow-templates` 0.11.59, ComfyUI 0.35.0/0.35.1
- Two installs present on this machine, see `apple-silicon-and-cli.md`
- 282 free templates, 558 total rows including API-tagged
